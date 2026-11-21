/**
 * Short stories. Bundled into the web app at build time (not fetched from the API), like the
 * reading room, so they work offline and adding a story needs only a Pages deploy.
 */
import type { Story } from '@oina/shared';
import { bareWord, storyWords } from '@oina/engine';
import raw from '../../../../content/stories.json';

export const STORIES = (raw as unknown as Story[]).slice().sort((a, b) => a.level - b.level);

export const storyWordCount = (s: Story) => s.paragraphs.flat().reduce((n, l) => n + storyWords(l).length, 0);

export const storyText = (s: Story) => s.paragraphs.flat().map((l) => l.cyrillic).join(' ');

export const LEVEL_FA: Record<Story['level'], string> = { 1: 'آسان', 2: 'متوسط', 3: 'سخت‌تر' };

/** Word pairs from every story, for the converter's dictionary. */
export function storyWordPairs(): [string, string][] {
  return STORIES.flatMap((s) => s.paragraphs.flat().flatMap((l) => storyWords(l).map((w) => [w.key, bareWord(w.fa)] as [string, string])));
}
