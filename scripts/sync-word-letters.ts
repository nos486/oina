/** pnpm content:sync — recomputes Word.letters from Word.cyrillic so authors never edit it by hand. */
import type { Letter, Word } from '@oina/shared';
import { uniqueLetters } from '@oina/engine';
import { readJson, writeJsonLines } from './lib/load-content.js';

const letters = readJson<Letter[]>('letters.json');
const byChar = new Map<string, Letter>();
for (const l of letters) {
  byChar.set(l.upper, l);
  byChar.set(l.lower, l);
}
const words = readJson<Word[]>('words.json');
let changed = 0;
const next = words.map((w) => {
  const ls = uniqueLetters(w.cyrillic, byChar);
  if (ls.join() !== w.letters.join()) changed++;
  // Keep a stable key order: letters right after lang.
  const { id, cyrillic, persian, meaningFa, lang, distractors, tags, needsReview } = w;
  return { id, cyrillic, persian, ...(meaningFa ? { meaningFa } : {}), lang, letters: ls, ...(distractors ? { distractors } : {}), tags, ...(needsReview ? { needsReview } : {}) };
});
writeJsonLines('words.json', next);
console.log(`Updated letters for ${changed} word(s).`);
