/** Short stories: scoring a read-through and turning story lines into tappable words. */
import type { MiniReading, Progress } from '@oina/shared';
import { bareWord, splitWords } from './translit.js';

/** XP for finishing a story the first time, and for reading it again. */
export const STORY_XP_FIRST = 15;
export const STORY_XP_AGAIN = 5;

/** Fewer words looked up = more stars. Finishing always earns at least one. */
export function storyStars(helped: number, words: number): 1 | 2 | 3 {
  const share = words > 0 ? helped / words : 0;
  if (share <= 0.05) return 3;
  if (share <= 0.2) return 2;
  return 1;
}

export function completeStory(progress: Progress, storyId: string, helped: number, words: number): Progress {
  const stars = storyStars(helped, words);
  const prev = progress.storyStars[storyId] ?? 0;
  return { ...progress, storyStars: { ...progress.storyStars, [storyId]: Math.max(prev, stars) as 1 | 2 | 3 } };
}

export interface StoryWord {
  /** The word as written, with its punctuation. */
  cyr: string;
  /** Its Persian-script form ("_" turned back into a space). */
  fa: string;
  /** Lower-case, without punctuation: the glossary key. */
  key: string;
}

/** Splits an aligned sentence into word pairs. */
export function storyWords(line: MiniReading): StoryWord[] {
  const fa = splitWords(line.persian);
  return splitWords(line.cyrillic).map((cyr, i) => ({ cyr, fa: (fa[i] ?? '').replaceAll('_', ' '), key: bareWord(cyr).toLowerCase() }));
}
