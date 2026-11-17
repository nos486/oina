/** pnpm content:validate — fails (exit 1) when content breaks the rules in the design doc. */
import { validateContent } from '@oina/engine';
import { loadBundle } from './lib/load-content.js';

const bundle = loadBundle();
const issues = validateContent(bundle);
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
