import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../content');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

export const bundle = {
  version: 'e2e',
  letters: read('letters.json'),
  words: read('words.json'),
  lessons: read('lessons.json'),
  stages: read('stages.json'),
};

/** Serves the content bundle without a running Worker. */
export async function mockApi(page: Page) {
  await page.route('**/api/v1/content', (route) => route.fulfill({ json: bundle }));
}

/** Starts with an empty progress but hearts off, so a test can answer blindly. */
export async function seedProgress(page: Page, patch: Record<string, unknown> = {}) {
  await page.addInitScript((p) => {
    if (!localStorage.getItem('progress:v1')) {
      localStorage.setItem('progress:v1', JSON.stringify({ version: 1, onboarded: false, settings: { hearts: false }, ...p }));
    }
  }, patch);
}
