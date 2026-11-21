/**
 * Exercise generation for the six MVP types. Questions are plain data so the UI only renders and
 * reports a response; grading lives here too.
 */
import type { ItemKey, Lesson, Letter, Progress, Word } from '@oina/shared';
import type { ContentIndex } from './content-index.js';
import { lessonsBefore, lettersTaughtThrough, splitLetters } from './content-index.js';
import { letterKey, parseItemKey, wordKey } from './progress.js';
import { topConfusions, weakestItems } from './review-engine.js';
import type { Rng } from './rng.js';
import { sample, shuffle } from './rng.js';

export type Script = 'cyr' | 'fa';

export interface ChoiceOption {
  id: string;
  label: string;
  script: Script;
  /** When the option is itself a learnable item (used to record Ҷ/Ч style confusions). */
  itemKey?: ItemKey;
  note?: string;
}

interface BaseQuestion {
  id: string;
  itemKey: ItemKey;
  /** Short hint shown in the feedback bar after a wrong answer. */
  tip?: string;
}

export interface ChoiceQuestion extends BaseQuestion {
  type: 'letterToSound' | 'soundToLetter' | 'readWord' | 'spotTrap';
  prompt: { text: string; script: Script };
  options: ChoiceOption[];
  correctId: string;
}

export interface BuildWordQuestion extends BaseQuestion {
  type: 'buildWord';
  prompt: { text: string; script: 'fa' };
  tiles: { id: string; label: string }[];
  /** Tile labels in the right order. */
  answer: string[];
}

export interface MatchQuestion extends BaseQuestion {
  type: 'match';
  pairs: { id: string; cyr: string; fa: string; itemKey: ItemKey }[];
}

export type Question = ChoiceQuestion | BuildWordQuestion | MatchQuestion;

export type Response =
  | { type: 'choice'; optionId: string }
  | { type: 'build'; labels: string[] }
  | { type: 'match'; wrongPairs: { pairId: string; chosenFa: string }[] };

export interface ItemResult {
  itemKey: ItemKey;
  correct: boolean;
  chosen?: string;
}

export interface Grade {
  correct: boolean;
  items: ItemResult[];
  /** Human-readable right answer for the feedback bar. */
  correctAnswer: string;
}

/** Cyrillic pairs that look alike; used to pick hard distractors. */
export const SIMILAR_LETTERS: [string, string][] = [
  ['j', 'ch'], ['i', 'y'], ['i', 'ii'], ['u', 'uu'], ['k', 'q'], ['kh', 'h'], ['g', 'gh'],
  ['s', 'z'], ['ye', 'yo'], ['ye', 'e'], ['sh', 'ch'], ['n', 'i'], ['b', 'v'], ['r', 'ya'],
];

const PERSIAN_FILLER = ['ب', 'ت', 'د', 'ر', 'س', 'ش', 'ک', 'گ', 'ل', 'م', 'ن', 'و', 'ی', 'ف', 'ز'];

export interface GenerateOptions {
  rng: Rng;
  now: Date;
  /** 1 = recognition, 2 = read words + match, 3 = build words. */
  level: 1 | 2 | 3;
  count?: number;
  /** Share of questions taken from weak items of earlier lessons. */
  reviewShare?: number;
}

export interface Ctx {
  index: ContentIndex;
  progress: Progress;
  rng: Rng;
  /** Letters the user may see in options. */
  knownLetters: Set<string>;
  /** Words the user may see in options. */
  knownWords: Word[];
}

let seq = 0;
const qid = (type: string, key: string) => `${type}:${key}:${(seq++).toString(36)}`;

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length]![b.length]!;
}

function similarTo(letterId: string): string[] {
  return SIMILAR_LETTERS.filter((p) => p.includes(letterId)).map((p) => (p[0] === letterId ? p[1] : p[0]));
}

// ---------- single-question builders ----------

export function letterToSound(ctx: Ctx, letter: Letter): ChoiceQuestion {
  const key = letterKey(letter.id);
  const correct = letter.persian[0]!;
  const pool: string[] = [];
  for (const c of topConfusions(ctx.progress, key)) if (!c.includes(':')) pool.push(c);
  if (letter.lookalikeFa) pool.push(letter.lookalikeFa);
  const others = shuffle(
    ctx.index.letters.filter((l) => l.id !== letter.id && ctx.knownLetters.has(l.id)).map((l) => l.persian[0]!),
    ctx.rng,
  );
  pool.push(...others, ...shuffle(PERSIAN_FILLER, ctx.rng));
  const wrong = [...new Set(pool)].filter((p) => !letter.persian.includes(p)).slice(0, 3);
  const options = shuffle([correct, ...wrong], ctx.rng).map((p) => ({ id: p, label: p, script: 'fa' as const }));
  return {
    id: qid('letterToSound', letter.id),
    type: 'letterToSound',
    itemKey: key,
    prompt: { text: `${letter.upper} ${letter.lower}`, script: 'cyr' },
    options,
    correctId: correct,
    tip: `${letter.upper} = ${letter.persian.join(' / ')} — ${letter.mnemonicFa}`,
  };
}

export function soundToLetter(ctx: Ctx, letter: Letter): ChoiceQuestion {
  const key = letterKey(letter.id);
  const ids: string[] = [];
  for (const c of topConfusions(ctx.progress, key)) {
    const parsed = parseItemKey(c);
    if (parsed?.kind === 'letter') ids.push(parsed.id);
  }
  ids.push(...similarTo(letter.id).filter((id) => ctx.knownLetters.has(id)));
  ids.push(...shuffle([...ctx.knownLetters], ctx.rng));
  // Only letters the user has met may appear (lesson 1 therefore has 3 options, not 4).
  const wrong = [...new Set(ids)]
    .filter((id) => id !== letter.id && ctx.knownLetters.has(id) && ctx.index.letterById.has(id))
    // A letter that also reads as the prompt (е/й/ӣ all read «ی») would be a second right answer.
    .filter((id) => !ctx.index.letterById.get(id)!.persian.includes(letter.persian[0]!))
    .slice(0, 3);
  const options = shuffle([letter.id, ...wrong], ctx.rng).map((id) => {
    const l = ctx.index.letterById.get(id)!;
    return { id, label: l.lower, script: 'cyr' as const, itemKey: letterKey(id) };
  });
  return {
    id: qid('soundToLetter', letter.id),
    type: 'soundToLetter',
    itemKey: key,
    prompt: { text: letter.persian[0]!, script: 'fa' },
    options,
    correctId: letter.id,
    tip: `«${letter.persian[0]}» = ${letter.upper} ${letter.lower}`,
  };
}

export function spotTrap(ctx: Ctx, letter: Letter): ChoiceQuestion | null {
  if (!letter.lookalike || !letter.lookalikeFa) return null;
  const correct = letter.persian[0]!;
  return {
    id: qid('spotTrap', letter.id),
    type: 'spotTrap',
    itemKey: letterKey(letter.id),
    prompt: { text: letter.upper, script: 'cyr' },
    options: shuffle(
      [
        { id: correct, label: correct, script: 'fa' as const },
        { id: letter.lookalikeFa, label: letter.lookalikeFa, script: 'fa' as const, note: `مثل ${letter.lookalike} لاتین` },
      ],
      ctx.rng,
    ),
    correctId: correct,
    tip: `${letter.upper} شبیه ${letter.lookalike} است ولی «${correct}» خوانده می‌شود`,
  };
}

export function readWord(ctx: Ctx, word: Word): ChoiceQuestion {
  const pool = [...(word.distractors ?? [])];
  const near = ctx.knownWords
    .filter((w) => w.id !== word.id && w.persian !== word.persian)
    .map((w) => ({ p: w.persian, d: editDistance(w.persian, word.persian) + ctx.rng() }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.p);
  pool.push(...near);
  const wrong = [...new Set(pool)].filter((p) => p !== word.persian).slice(0, 3);
  const options = shuffle([word.persian, ...wrong], ctx.rng).map((p) => ({ id: p, label: p, script: 'fa' as const }));
  return {
    id: qid('readWord', word.id),
    type: 'readWord',
    itemKey: wordKey(word.id),
    prompt: { text: word.cyrillic, script: 'cyr' },
    options,
    correctId: word.persian,
    tip: word.meaningFa ? `${word.cyrillic} = ${word.persian} (${word.meaningFa})` : `${word.cyrillic} = ${word.persian}`,
  };
}

export function buildWord(ctx: Ctx, word: Word): BuildWordQuestion | null {
  const chars = [...word.cyrillic.normalize('NFC')].filter((c) => !/\s/.test(c));
  if (chars.length < 2 || chars.length > 10 || /\s/.test(word.cyrillic)) return null;
  const lower = chars.map((c, i) => (i === 0 && word.tags.includes('نام خاص') ? c : c.toLowerCase()));
  const used = new Set(splitLetters(word.cyrillic, ctx.index.letterByChar).ids);
  const extra: string[] = [];
  for (const id of used) extra.push(...similarTo(id).filter((s) => ctx.knownLetters.has(s) && !used.has(s)));
  extra.push(...shuffle([...ctx.knownLetters].filter((id) => !used.has(id)), ctx.rng));
  const distractors = [...new Set(extra)].slice(0, 2).map((id) => ctx.index.letterById.get(id)!.lower);
  const tiles = shuffle([...lower, ...distractors], ctx.rng).map((label, i) => ({ id: `t${i}`, label }));
  return {
    id: qid('buildWord', word.id),
    type: 'buildWord',
    itemKey: wordKey(word.id),
    prompt: { text: word.persian, script: 'fa' },
    tiles,
    answer: lower,
    tip: `${word.persian} = ${word.cyrillic}`,
  };
}

export function match(ctx: Ctx, words: Word[]): MatchQuestion | null {
  const uniq = [...new Map(words.map((w) => [w.persian, w])).values()].slice(0, 5);
  if (uniq.length < 3) return null;
  return {
    id: qid('match', uniq.map((w) => w.id).join('+')),
    type: 'match',
    itemKey: wordKey(uniq[0]!.id),
    pairs: uniq.map((w) => ({ id: w.id, cyr: w.cyrillic, fa: w.persian, itemKey: wordKey(w.id) })),
  };
}

// ---------- grading ----------

export function grade(q: Question, r: Response): Grade {
  if (q.type === 'match') {
    if (r.type !== 'match') throw new Error('response type mismatch');
    const wrongById = new Map(r.wrongPairs.map((w) => [w.pairId, w.chosenFa]));
    return {
      // The user always finishes a match board; mistakes still count per item.
      correct: r.wrongPairs.length === 0,
      items: q.pairs.map((p) => ({ itemKey: p.itemKey, correct: !wrongById.has(p.id), chosen: wrongById.get(p.id) })),
      correctAnswer: q.pairs.map((p) => `${p.cyr} = ${p.fa}`).join('، '),
    };
  }
  if (q.type === 'buildWord') {
    if (r.type !== 'build') throw new Error('response type mismatch');
    const ok = r.labels.join('') === q.answer.join('');
    return { correct: ok, items: [{ itemKey: q.itemKey, correct: ok, chosen: ok ? undefined : r.labels.join('') }], correctAnswer: q.answer.join('') };
  }
  if (r.type !== 'choice') throw new Error('response type mismatch');
  const ok = r.optionId === q.correctId;
  const opt = q.options.find((o) => o.id === r.optionId);
  const correctLabel = q.options.find((o) => o.id === q.correctId)?.label ?? q.correctId;
  return {
    correct: ok,
    items: [{ itemKey: q.itemKey, correct: ok, chosen: ok ? undefined : (opt?.itemKey ?? opt?.label) }],
    correctAnswer: correctLabel,
  };
}

// ---------- lesson / review generation ----------

export function contextFor(index: ContentIndex, progress: Progress, rng: Rng, lessonId?: string): Ctx {
  const knownLetters = lessonId
    ? lettersTaughtThrough(index, lessonId)
    : new Set(index.lessonOrder.filter((l) => progress.completedLessons.includes(l.id)).flatMap((l) => l.newLetters));
  const lessonsSoFar = lessonId
    ? [...lessonsBefore(index, lessonId), index.lessonById.get(lessonId)!]
    : index.lessonOrder.filter((l) => progress.completedLessons.includes(l.id));
  const knownWords = [...new Set(lessonsSoFar.flatMap((l) => l.words))]
    .map((id) => index.wordById.get(id))
    .filter((w): w is Word => !!w);
  return { index, progress, rng, knownLetters, knownWords };
}

/** One question for an item, with a type that suits the level. `avoid` picks another form (used on retry). */
export function questionForItem(ctx: Ctx, key: ItemKey, level: 1 | 2 | 3, avoid?: Question['type']): Question | null {
  const parsed = parseItemKey(key);
  if (!parsed) return null;
  if (parsed.kind === 'letter') {
    const letter = ctx.index.letterById.get(parsed.id);
    if (!letter) return null;
    const makers: (() => Question | null)[] =
      level === 1
        ? [() => letterToSound(ctx, letter), () => soundToLetter(ctx, letter), () => spotTrap(ctx, letter)]
        : [() => soundToLetter(ctx, letter), () => letterToSound(ctx, letter)];
    for (const make of avoid ? shuffle(makers, ctx.rng) : makers) {
      const q = make();
      if (q && q.type !== avoid) return q;
    }
    return letterToSound(ctx, letter);
  }
  const word = ctx.index.wordById.get(parsed.id);
  if (!word) return null;
  const makers: (() => Question | null)[] =
    level === 3 ? [() => buildWord(ctx, word), () => readWord(ctx, word)] : [() => readWord(ctx, word), () => buildWord(ctx, word)];
  for (const make of makers) {
    const q = make();
    if (q && q.type !== avoid) return q;
  }
  return readWord(ctx, word);
}

const DIFFICULTY: Record<Question['type'], number> = {
  spotTrap: 0, letterToSound: 1, soundToLetter: 2, readWord: 3, match: 4, buildWord: 5,
};

/**
 * Builds the question list for a lesson: new letters first, then words, easy to hard,
 * with ~30% taken from weak items of earlier lessons.
 */
export function generateLessonQuestions(index: ContentIndex, lesson: Lesson, progress: Progress, opts: GenerateOptions): Question[] {
  const { rng, now, level } = opts;
  const count = opts.count ?? 10;
  const ctx = contextFor(index, progress, rng, lesson.id);
  const words = lesson.words.map((id) => index.wordById.get(id)).filter((w): w is Word => !!w);

  // Weak items from earlier lessons (only ones the user has actually seen).
  const earlierKeys = lessonsBefore(index, lesson.id).flatMap((l) => [
    ...l.newLetters.map(letterKey),
    ...l.words.map(wordKey),
  ]);
  const reviewN = Math.round(count * (opts.reviewShare ?? 0.3));
  const reviewKeys = weakestItems(progress, earlierKeys, now, reviewN);

  const out: Question[] = [];
  const newLetterKeys = lesson.newLetters.map(letterKey);

  // Each new letter: recognition first (and a trap check at level 1).
  for (const l of lesson.newLetters) {
    const letter = index.letterById.get(l)!;
    out.push(level === 1 ? letterToSound(ctx, letter) : soundToLetter(ctx, letter));
    if (level === 1) {
      const trap = spotTrap(ctx, letter);
      if (trap) out.push(trap);
    }
  }
  // A match board at levels 2–3 when the lesson has enough words.
  if (level >= 2) {
    const m = match(ctx, sample(words, 5, rng));
    if (m) out.push(m);
  }
  const newBudget = Math.max(0, count - reviewKeys.length - out.length);
  // Prefer words that contain the new letters.
  const withNew = words.filter((w) => w.letters.some((x) => lesson.newLetters.includes(x)));
  const rest = words.filter((w) => !withNew.includes(w));
  const wordPicks = [...shuffle(withNew, rng), ...shuffle(rest, rng)].slice(0, newBudget);
  for (const w of wordPicks) {
    const q = questionForItem(ctx, wordKey(w.id), level);
    if (q) out.push(q);
  }
  // If there are not enough words, add a second form of each new letter.
  for (let i = 0; out.length + reviewKeys.length < count && i < newLetterKeys.length * 2; i++) {
    const q = questionForItem(ctx, newLetterKeys[i % newLetterKeys.length]!, level, out.find((x) => x.itemKey === newLetterKeys[i % newLetterKeys.length])?.type);
    if (q) out.push(q);
  }
  for (const key of reviewKeys) {
    const q = questionForItem(ctx, key, level);
    if (q) out.push(q);
  }
  // Stable sort by difficulty; keep the generated order inside each tier.
  return out
    .map((q, i) => ({ q, i }))
    .sort((a, b) => DIFFICULTY[a.q.type] - DIFFICULTY[b.q.type] || a.i - b.i)
    .map((x) => x.q);
}

/** Questions for a list of items (daily review, "my mistakes"). */
export function generateReviewQuestions(index: ContentIndex, progress: Progress, keys: ItemKey[], rng: Rng): Question[] {
  const ctx = contextFor(index, progress, rng);
  return keys
    .map((k) => questionForItem(ctx, k, rng() < 0.5 ? 1 : 2))
    .filter((q): q is Question => !!q);
}

/** Stage test: n random questions over the whole stage, mixed levels. */
export function generateStageTest(index: ContentIndex, stageId: number, progress: Progress, rng: Rng, n = 15): Question[] {
  const stage = index.stageById.get(stageId);
  if (!stage || !stage.lessons.length) return [];
  const lastLesson = stage.lessons[stage.lessons.length - 1]!;
  const ctx = contextFor(index, progress, rng, lastLesson);
  const lessons = stage.lessons.map((id) => index.lessonById.get(id)!).filter(Boolean);
  const keys: ItemKey[] = [
    ...lessons.flatMap((l) => l.newLetters.map(letterKey)),
    ...lessons.flatMap((l) => l.words.map(wordKey)),
  ];
  return sample([...new Set(keys)], n, rng)
    .map((k) => questionForItem(ctx, k, (1 + Math.floor(rng() * 3)) as 1 | 2 | 3))
    .filter((q): q is Question => !!q)
    .sort((a, b) => DIFFICULTY[a.type] - DIFFICULTY[b.type]);
}
