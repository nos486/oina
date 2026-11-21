/** pnpm content:validate — fails (exit 1) when content breaks the rules in the design doc. */
import type { Reading } from '@oina/shared';
import { splitWords, validateContent } from '@oina/engine';
import { loadBundle, readJson } from './lib/load-content.js';

const bundle = loadBundle();
const issues = validateContent(bundle);
// Reading room: word-by-word reveal needs the same word count in both scripts.
for (const r of readJson<Reading[]>('readings.json')) {
  r.lines.forEach((l, i) => {
    const a = splitWords(l.cyrillic).length;
    const b = splitWords(l.persian).length;
    if (a !== b) issues.push({ level: 'error', where: `reading ${r.id} line ${i + 1}`, message: `${a} Cyrillic words but ${b} Persian words` });
  });
}
const errors = issues.filter((i) => i.level === 'error');
const warnings = issues.filter((i) => i.level === 'warning');
const verbose = process.argv.includes('--verbose');

for (const i of errors) console.error(`✗ ${i.where}: ${i.message}`);
if (verbose) for (const i of warnings) console.warn(`! ${i.where}: ${i.message}`);
else if (warnings.length) console.warn(`! ${warnings.length} warning(s); run with --verbose to list them`);

console.log(
  `${bundle.letters.length} letters, ${bundle.words.length} words, ${bundle.lessons.length} lessons, ${bundle.stages.length} stages`,
);
if (errors.length) {
  console.error(`\n${errors.length} error(s).`);
  process.exit(1);
}
console.log('Content OK');
