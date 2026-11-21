/** Content is bundled into the Worker at deploy time from /content (later: D1). */
import type { ContentBundle, Lesson, Letter, Reading, Stage, Word } from '@oina/shared';
import letters from '../../../content/letters.json';
import words from '../../../content/words.json';
import lessons from '../../../content/lessons.json';
import stages from '../../../content/stages.json';
import readings from '../../../content/readings.json';

const raw = {
  letters: letters as Letter[],
  words: words as Word[],
  lessons: lessons as Lesson[],
  stages: stages as Stage[],
};

/** Short content hash, used as the bundle version and ETag. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export const CONTENT_VERSION = hash(JSON.stringify(raw));
export const bundle: ContentBundle = { version: CONTENT_VERSION, ...raw };
export const allReadings = readings as Reading[];
