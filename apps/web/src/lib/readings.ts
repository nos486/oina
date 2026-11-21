/**
 * Reading-room texts. Bundled into the web app at build time (not fetched from the API), so the
 * reading room works offline and needs no Worker redeploy when texts are added.
 */
import type { Reading } from '@oina/shared';
import { bareWord, splitWords } from '@oina/engine';
import raw from '../../../../content/readings.json';

export const READINGS = raw as Reading[];

/** Word pairs from every line, for the converter's dictionary. */
export function readingWordPairs(): [string, string][] {
  const pairs: [string, string][] = [];
  for (const r of READINGS) {
    for (const l of r.lines) {
      const a = splitWords(l.cyrillic);
      const b = splitWords(l.persian);
      if (a.length !== b.length) continue;
      a.forEach((w, i) => pairs.push([bareWord(w).toLowerCase(), bareWord(b[i]!)]));
    }
  }
  return pairs;
}
