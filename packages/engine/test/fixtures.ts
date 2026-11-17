import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContentBundle } from '@oina/shared';
import { buildIndex } from '../src/index.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../content');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

export function realBundle(): ContentBundle {
  return {
    version: 'test',
    letters: read('letters.json'),
    words: read('words.json'),
    lessons: read('lessons.json'),
    stages: read('stages.json'),
    audio: [],
  };
}

export const realIndex = () => buildIndex(realBundle());
export const T0 = new Date('2026-11-17T10:00:00Z');
export const later = (d: Date, ms: number) => new Date(d.getTime() + ms);
