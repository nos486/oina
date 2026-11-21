/**
 * Review checkpoints on the path, the general exam and the practice sets of the review tab.
 * Pure functions over the content index and Progress.
 */
import type { ExamRecord, ItemKey, Lesson, Progress } from '@oina/shared';
import type { ContentIndex } from './content-index.js';
import type { Ctx, Question } from './exercises.js';
import { contextFor, match, questionForItem } from './exercises.js';
import { letterKey, wordKey } from './progress.js';
import { effectiveStrength, reviewPriority } from './review-engine.js';
import type { Rng } from './rng.js';
import { sample, shuffle } from './rng.js';

// ---------- review checkpoints ----------

/** A review node on the path: revisits everything taught so far, with most questions on older lessons. */
export interface Checkpoint {
  /** "review-s2-1" */
  id: string;
  stageId: number;
  /** 1-based number of the checkpoint inside its stage. */
  n: number;
  /** The checkpoint sits right after this lesson. */
  afterLessonId: string;
  /** The (up to) two lessons just before the checkpoint. */
  recentLessonIds: string[];
  /** Every lesson taught before the recent ones. */
  olderLessonIds: string[];
}

/** A checkpoint comes after every second lesson of a stage, unless the stage test follows anyway. */
export const LESSONS_PER_CHECKPOINT = 2;
export const CHECKPOINT_QUESTIONS = 12;
/** Share of checkpoint questions taken from older lessons when there are any. */
export const CHECKPOINT_OLDER_SHARE = 0.6;
export const EXAM_QUESTIONS = 20;
export const MAX_EXAM_HISTORY = 20;

export function checkpoints(index: ContentIndex): Checkpoint[] {
  const out: Checkpoint[] = [];
  const order = index.lessonOrder.map((l) => l.id);
  for (const stage of index.stages) {
    const ids = stage.lessons.filter((id) => index.lessonById.has(id));
    let n = 0;
    for (let i = LESSONS_PER_CHECKPOINT - 1; i < ids.length - 1; i += LESSONS_PER_CHECKPOINT) {
      n += 1;
      const after = ids[i]!;
      const pos = order.indexOf(after);
      const recent = ids.slice(i + 1 - LESSONS_PER_CHECKPOINT, i + 1);
      out.push({
        id: `review-s${stage.id}-${n}`,
        stageId: stage.id,
        n,
        afterLessonId: after,
        recentLessonIds: recent,
        olderLessonIds: order.slice(0, pos + 1).filter((id) => !recent.includes(id)),
      });
    }
  }
  return out;
}

const keysOf = (lessons: Lesson[]): ItemKey[] => [
  ...new Set([...lessons.flatMap((l) => l.newLetters.map(letterKey)), ...lessons.flatMap((l) => l.words.map(wordKey))]),
];

const lessonsFor = (index: ContentIndex, ids: string[]) => ids.map((id) => index.lessonById.get(id)).filter((l): l is Lesson => !!l);

/**
 * Half weak items (seen, lowest strength first), half random, so a set both repairs what slipped
 * and surprises the user with things they have not seen in a while.
 */
export function pickMixed(progress: Progress, keys: ItemKey[], n: number, rng: Rng, now: Date): ItemKey[] {
  if (keys.length <= n) return shuffle(keys, rng);
  const seen = keys
    .filter((k) => progress.items[k])
    .sort((a, b) => reviewPriority(progress, b, now) - reviewPriority(progress, a, now));
  const weak = seen.slice(0, Math.ceil(n / 2));
  const rest = sample(keys.filter((k) => !weak.includes(k)), n - weak.length, rng);
  return shuffle([...weak, ...rest], rng);
}

/** Balanced pick: roughly one letter for every two words, so letters are not drowned by 400+ words. */
function pickBalanced(progress: Progress, keys: ItemKey[], n: number, rng: Rng, now: Date): ItemKey[] {
  const letters = keys.filter((k) => k.startsWith('letter:'));
  const words = keys.filter((k) => k.startsWith('word:'));
  const nl = Math.min(letters.length, Math.max(1, Math.round(n / 3)));
  const nw = Math.min(words.length, n - nl);
  const picked = [...pickMixed(progress, letters, nl, rng, now), ...pickMixed(progress, words, nw, rng, now)];
  // Top up with letters when there are too few words.
  if (picked.length < n) picked.push(...pickMixed(progress, letters.filter((k) => !picked.includes(k)), n - picked.length, rng, now));
  return shuffle(picked, rng);
}

/** Level for a question: mostly reading words (2) and building them (3), some recognition (1). */
const mixedLevel = (rng: Rng): 1 | 2 | 3 => {
  const r = rng();
  return r < 0.3 ? 1 : r < 0.7 ? 2 : 3;
};

function toQuestions(ctx: Ctx, keys: ItemKey[], rng: Rng, level?: 1 | 2 | 3): Question[] {
  return keys.map((k) => questionForItem(ctx, k, level ?? mixedLevel(rng))).filter((q): q is Question => !!q);
}

export interface PracticeSet {
  ctx: Ctx;
  questions: Question[];
}

export function generateCheckpoint(index: ContentIndex, progress: Progress, cp: Checkpoint, rng: Rng, now: Date, n = CHECKPOINT_QUESTIONS): PracticeSet {
  const ctx = contextFor(index, progress, rng, cp.afterLessonId);
  const recent = keysOf(lessonsFor(index, cp.recentLessonIds));
  const older = keysOf(lessonsFor(index, cp.olderLessonIds)).filter((k) => !recent.includes(k));
  const nOlder = older.length ? Math.min(older.length, Math.round(n * CHECKPOINT_OLDER_SHARE)) : 0;
  const keys = [...pickBalanced(progress, older, nOlder, rng, now), ...pickBalanced(progress, recent, n - nOlder, rng, now)];
  const questions = toQuestions(ctx, shuffle(keys, rng), rng);
  // One match board of older words keeps the old vocabulary in play.
  const olderWords = older.filter((k) => k.startsWith('word:')).map((k) => index.wordById.get(k.slice(5))!).filter(Boolean);
  const board = match(ctx, sample(olderWords.length >= 3 ? olderWords : ctx.knownWords, 5, rng));
  if (board) questions.splice(Math.floor(questions.length / 2), 0, board);
  return { ctx, questions };
}

export function checkpointStars(score: number): 0 | 1 | 2 | 3 {
  if (score >= 0.95) return 3;
  if (score >= 0.8) return 2;
  if (score >= 0.6) return 1;
  return 0;
}

export function completeCheckpoint(progress: Progress, checkpointId: string, score: number): Progress {
  const stars = checkpointStars(score);
  const prev = progress.reviewStars[checkpointId] ?? 0;
  return { ...progress, reviewStars: { ...progress.reviewStars, [checkpointId]: Math.max(prev, stars) as 0 | 1 | 2 | 3 } };
}

// ---------- what the user has learned ----------

/** Lessons the user has finished, in teaching order. */
export function learnedLessons(index: ContentIndex, progress: Progress): Lesson[] {
  return index.lessonOrder.filter((l) => progress.completedLessons.includes(l.id));
}

/** Letters and words of every finished lesson. */
export function learnedKeys(index: ContentIndex, progress: Progress): ItemKey[] {
  return keysOf(learnedLessons(index, progress));
}

export interface StrengthSummary {
  strong: number;
  medium: number;
  weak: number;
  total: number;
}

export function strengthSummary(progress: Progress, keys: ItemKey[], now: Date): StrengthSummary {
  const s: StrengthSummary = { strong: 0, medium: 0, weak: 0, total: keys.length };
  for (const k of keys) {
    const v = effectiveStrength(progress.items[k], now);
    if (v >= 70) s.strong += 1;
    else if (v >= 40) s.medium += 1;
    else s.weak += 1;
  }
  return s;
}

// ---------- practice sets (review tab) ----------

export type PracticeKind = 'letters' | 'words' | 'stage' | 'mix';

/** A practice set over learned items: only letters, only words, one stage, or a mix of everything. */
export function generatePractice(
  index: ContentIndex, progress: Progress, kind: PracticeKind, rng: Rng, now: Date, opts: { stageId?: number; n?: number } = {},
): PracticeSet {
  const n = opts.n ?? 12;
  const ctx = contextFor(index, progress, rng);
  let keys = learnedKeys(index, progress);
  if (kind === 'stage') {
    const stage = index.stageById.get(opts.stageId ?? -1);
    keys = stage ? keysOf(lessonsFor(index, stage.lessons).filter((l) => progress.completedLessons.includes(l.id))) : [];
  }
  if (kind === 'letters') {
    const letters = keys.filter((k) => k.startsWith('letter:'));
    return { ctx, questions: toQuestions(ctx, pickMixed(progress, letters, n, rng, now), rng, 1) };
  }
  if (kind === 'words') {
    const words = keys.filter((k) => k.startsWith('word:'));
    const questions = toQuestions(ctx, pickMixed(progress, words, n, rng, now), rng);
    const board = match(ctx, sample(ctx.knownWords, 5, rng));
    if (board && questions.length >= 6) questions.splice(Math.floor(questions.length / 2), 0, board);
    return { ctx, questions };
  }
  return { ctx, questions: toQuestions(ctx, pickBalanced(progress, keys, n, rng, now), rng) };
}

// ---------- general exam ----------

/**
 * The general exam: questions spread over every finished stage (not only the weak items), so the
 * score says how much of what was taught the user can really read. No retries.
 */
export function generateExam(index: ContentIndex, progress: Progress, rng: Rng, n = EXAM_QUESTIONS): PracticeSet {
  const ctx = contextFor(index, progress, rng);
  const lessons = learnedLessons(index, progress);
  const byStage = new Map<number, Lesson[]>();
  for (const l of lessons) byStage.set(l.stageId, [...(byStage.get(l.stageId) ?? []), l]);
  const groups = [...byStage.values()].map((ls) => shuffle(keysOf(ls), rng));
  // Round-robin over stages so every stage gets its share.
  const keys: ItemKey[] = [];
  for (let i = 0; keys.length < n && groups.some((g) => g.length > i); i++) {
    for (const g of groups) if (g[i] && keys.length < n) keys.push(g[i]!);
  }
  const questions = keys
    .map((k) => questionForItem(ctx, k, k.startsWith('letter:') ? (rng() < 0.5 ? 1 : 2) : rng() < 0.6 ? 2 : 3))
    .filter((q): q is Question => !!q);
  return { ctx, questions: shuffle(questions, rng) };
}

export function examGrade(score: number): { labelFa: string; emoji: string } {
  if (score >= 0.95) return { labelFa: 'عالی', emoji: '🏆' };
  if (score >= 0.8) return { labelFa: 'خیلی خوب', emoji: '🌟' };
  if (score >= 0.6) return { labelFa: 'خوب', emoji: '👍' };
  return { labelFa: 'نیاز به مرور', emoji: '📚' };
}

export function recordExam(progress: Progress, record: ExamRecord): Progress {
  return { ...progress, exams: [record, ...progress.exams].slice(0, MAX_EXAM_HISTORY) };
}

export function bestExam(progress: Progress): ExamRecord | undefined {
  return progress.exams.reduce<ExamRecord | undefined>((best, e) => (!best || e.correct / e.total > best.correct / best.total ? e : best), undefined);
}

/**
 * The checkpoint the user should do now: its lessons are done, it has no stars yet, and the
 * user has not moved past it (the next lesson is the one right after it).
 */
export function pendingCheckpoint(index: ContentIndex, progress: Progress): Checkpoint | undefined {
  const order = index.lessonOrder.map((l) => l.id);
  const next = order.find((id) => !progress.completedLessons.includes(id));
  return checkpoints(index).find((cp) => {
    if ((progress.reviewStars[cp.id] ?? 0) > 0) return false;
    if (!progress.completedLessons.includes(cp.afterLessonId)) return false;
    return next === order[order.indexOf(cp.afterLessonId) + 1];
  });
}
