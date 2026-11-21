/**
 * Content model (design doc, section 8). All learning content is data, not code:
 * adding a lesson or a word is a JSON edit in /content.
 */

/** friend = looks and sounds like Latin; trap = looks Latin, sounds different; new = unfamiliar shape;
 * tajik = Tajik-only letters; combo = Я Ё Ю; sign = Ъ; russianOnly = Ы Ц Щ Ь (Russian track). */
export type Category = 'friend' | 'trap' | 'new' | 'tajik' | 'combo' | 'sign' | 'russianOnly';

export type Lang = 'tg' | 'ru';

export interface Letter {
  /** Stable id used in file names and progress keys, e.g. "sha". */
  id: string;
  upper: string;
  lower: string;
  /** Persian letters/vowel marks this letter maps to. First one is the main answer. */
  persian: string[];
  ipa: string;
  category: Category;
  /** Visual hook in Persian. */
  mnemonicFa: string;
  /** A Latin lookalike, used for trap warnings and the spot-the-trap exercise. */
  lookalike?: string;
  /** What a reader of the lookalike would wrongly say, in Persian (e.g. "پ" for Р). */
  lookalikeFa?: string;
  russianNote?: string;
  /** Example words (ids) shown on the intro card. */
  examples: string[];
  /** Tracks this letter belongs to. */
  tracks: Lang[];
}

export interface Word {
  id: string;
  cyrillic: string;
  persian: string;
  /** Only when the meaning differs from Iranian Persian. */
  meaningFa?: string;
  lang: Lang;
  /** Letter ids, in order of appearance (deduplicated). Kept in sync by `pnpm content:sync`. */
  letters: string[];
  /** Hand-picked wrong answers for the read-word exercise. */
  distractors?: string[];
  tags: string[];
  /** True when the Tajik spelling still needs a native speaker's check. */
  needsReview?: boolean;
}

export type ExerciseType =
  | 'letterToSound'
  | 'soundToLetter'
  | 'readWord'
  | 'buildWord'
  | 'match'
  | 'spotTrap'
  | 'dictation'
  | 'missingLetter'
  | 'streetSign'
  | 'speedRun';

export const MVP_EXERCISE_TYPES = [
  'letterToSound',
  'soundToLetter',
  'readWord',
  'buildWord',
  'match',
  'spotTrap',
] as const satisfies readonly ExerciseType[];

export interface ExerciseSpec {
  type: ExerciseType;
  itemIds: string[];
}

export interface MiniReading {
  cyrillic: string;
  persian: string;
}

export interface Lesson {
  /** "s4-l2" */
  id: string;
  stageId: number;
  titleFa: string;
  newLetters: string[];
  words: string[];
  /** Empty = generated automatically from letters and words. */
  exercises: ExerciseSpec[];
  miniReading?: MiniReading;
}

export interface Stage {
  id: number;
  titleFa: string;
  descriptionFa: string;
  track: Lang;
  lessons: string[];
  /** Not part of the MVP yet; shown as "coming soon". */
  comingSoon?: boolean;
}

export interface Reading {
  id: string;
  titleFa: string;
  /** Poet or source, e.g. "رودکی". */
  sourceFa?: string;
  level: number;
  kind?: 'everyday' | 'proverb' | 'poem';
  /** Each line must have the same number of space-separated words in both scripts (word-by-word reveal). */
  lines: MiniReading[];
}

/** Everything the client needs to run lessons, in one payload. */
export interface ContentBundle {
  version: string;
  letters: Letter[];
  words: Word[];
  lessons: Lesson[];
  stages: Stage[];
  /** Audio files that actually exist, relative to the audio base, e.g. "tg/letters/sha-name.mp3". */
  audio: string[];
}

/** Audio file naming convention (design doc, section 6). */
export const audioPath = {
  letterName: (letterId: string) => `tg/letters/${letterId}-name.mp3`,
  letterSound: (letterId: string) => `tg/letters/${letterId}-sound.mp3`,
  word: (word: Pick<Word, 'id' | 'lang'>) => `${word.lang}/words/${word.id}.mp3`,
};
