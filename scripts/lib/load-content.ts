import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContentBundle, Lesson, Letter, Stage, Word } from '@oina/shared';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CONTENT_DIR = path.join(ROOT, 'content');

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8')) as T;
}

export function writeJsonLines(file: string, items: unknown[]): void {
  // One object per line keeps diffs small and reviews easy.
  fs.writeFileSync(path.join(CONTENT_DIR, file), '[\n' + items.map((o) => '  ' + JSON.stringify(o)).join(',\n') + '\n]\n');
}

export function loadBundle(): ContentBundle {
  return {
    version: 'local',
    letters: readJson<Letter[]>('letters.json'),
    words: readJson<Word[]>('words.json'),
    lessons: readJson<Lesson[]>('lessons.json'),
    stages: readJson<Stage[]>('stages.json'),
  };
}
