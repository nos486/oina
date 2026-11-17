import type { ContentBundle, Lesson, Letter, Stage, Word } from '@oina/shared';

/** Characters that are not letters and are ignored by the letter rules. */
const IGNORED = /[\s\-–—.,!?؟«»"'()]/u;

export interface ContentIndex {
  bundle: ContentBundle;
  letters: Letter[];
  words: Word[];
  lessons: Lesson[];
  stages: Stage[];
  letterById: Map<string, Letter>;
  letterByChar: Map<string, Letter>;
  wordById: Map<string, Word>;
  lessonById: Map<string, Lesson>;
  stageById: Map<number, Stage>;
  /** Lessons in teaching order (stage order, then lesson order inside the stage). */
  lessonOrder: Lesson[];
  audio: Set<string>;
}

export function buildIndex(bundle: ContentBundle): ContentIndex {
  const letterById = new Map(bundle.letters.map((l) => [l.id, l]));
  const letterByChar = new Map<string, Letter>();
  for (const l of bundle.letters) {
    letterByChar.set(l.upper, l);
    letterByChar.set(l.lower, l);
  }
  const lessonById = new Map(bundle.lessons.map((l) => [l.id, l]));
  const stages = [...bundle.stages].sort((a, b) => a.id - b.id);
  const lessonOrder = stages.flatMap((s) =>
    s.lessons.map((id) => lessonById.get(id)).filter((l): l is Lesson => !!l),
  );
  return {
    bundle,
    letters: bundle.letters,
    words: bundle.words,
    lessons: bundle.lessons,
    stages,
    letterById,
    letterByChar,
    wordById: new Map(bundle.words.map((w) => [w.id, w])),
    lessonById,
    stageById: new Map(stages.map((s) => [s.id, s])),
    lessonOrder,
    audio: new Set(bundle.audio),
  };
}

export interface LetterSplit {
  ids: string[];
  unknown: string[];
}

/** Splits Cyrillic text into letter ids (with repeats, in order) using a char→letter map. */
export function splitLetters(text: string, letterByChar: Map<string, Letter>): LetterSplit {
  const ids: string[] = [];
  const unknown: string[] = [];
  for (const ch of text.normalize('NFC')) {
    if (IGNORED.test(ch)) continue;
    const l = letterByChar.get(ch);
    if (l) ids.push(l.id);
    else unknown.push(ch);
  }
  return { ids, unknown };
}

export function uniqueLetters(text: string, letterByChar: Map<string, Letter>): string[] {
  return [...new Set(splitLetters(text, letterByChar).ids)];
}

/** Letters taught up to and including the given lesson. */
export function lettersTaughtThrough(index: ContentIndex, lessonId: string): Set<string> {
  const known = new Set<string>();
  for (const lesson of index.lessonOrder) {
    lesson.newLetters.forEach((l) => known.add(l));
    if (lesson.id === lessonId) break;
  }
  return known;
}

/** Letters taught by the lessons the user has completed. */
export function lettersLearned(index: ContentIndex, completedLessons: Iterable<string>): Set<string> {
  const done = new Set(completedLessons);
  const known = new Set<string>();
  for (const lesson of index.lessonOrder) {
    if (done.has(lesson.id)) lesson.newLetters.forEach((l) => known.add(l));
  }
  return known;
}

export function lessonsBefore(index: ContentIndex, lessonId: string): Lesson[] {
  const i = index.lessonOrder.findIndex((l) => l.id === lessonId);
  return i < 0 ? [] : index.lessonOrder.slice(0, i);
}

export function nextLesson(index: ContentIndex, completedLessons: Iterable<string>): Lesson | undefined {
  const done = new Set(completedLessons);
  return index.lessonOrder.find((l) => !done.has(l.id));
}
