/**
 * pnpm audio:list [--dir apps/web/public/audio]
 * Scans the audio folder, writes content/audio-manifest.json (files that exist) and
 * audio-missing.txt (files still to record), following the naming rules in the design doc.
 */
import fs from 'node:fs';
import path from 'node:path';
import { audioPath, type Letter, type Word } from '@oina/shared';
import { CONTENT_DIR, ROOT, readJson } from './lib/load-content.js';

const dirArg = process.argv.indexOf('--dir');
const audioDir = path.resolve(ROOT, dirArg > 0 ? process.argv[dirArg + 1]! : 'apps/web/public/audio');

const letters = readJson<Letter[]>('letters.json');
const words = readJson<Word[]>('words.json');
const expected: { file: string; what: string }[] = [];
for (const l of letters.filter((x) => x.tracks.includes('tg'))) {
  expected.push({ file: audioPath.letterName(l.id), what: `name of ${l.upper}` });
  expected.push({ file: audioPath.letterSound(l.id), what: `sound of ${l.upper}` });
}
// Russian words use the browser voice (Web Speech API, ru-RU), so only Tajik words need files.
for (const w of words.filter((x) => x.lang === 'tg')) expected.push({ file: audioPath.word(w), what: w.cyrillic });

const exists = (f: string) => fs.existsSync(path.join(audioDir, f));
const present = expected.filter((e) => exists(e.file)).map((e) => e.file);
const missing = expected.filter((e) => !exists(e.file));

fs.writeFileSync(path.join(CONTENT_DIR, 'audio-manifest.json'), JSON.stringify(present, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'audio-missing.txt'), missing.map((m) => `${m.file}\t${m.what}`).join('\n') + '\n');
console.log(`Audio dir: ${path.relative(ROOT, audioDir) || '.'}`);
console.log(`${present.length} present, ${missing.length} missing (see audio-missing.txt)`);
console.log('Format: mp3, mono, 64 kbps, ~0.15 s silence before, ~0.2 s after.');
