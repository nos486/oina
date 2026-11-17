import { describe, expect, it } from 'vitest';
import { lettersTaughtThrough, nextLesson, uniqueLetters, validateContent } from '../src/index.js';
import { realBundle, realIndex } from './fixtures.js';

describe('content rules', () => {
  it('the real content has no errors', () => {
    const errors = validateContent(realBundle()).filter((i) => i.level === 'error');
    expect(errors).toEqual([]);
  });

  it('teaches all 35 Tajik letters across stages 1–6', () => {
    const idx = realIndex();
    const last = idx.stageById.get(6)!.lessons.at(-1)!;
    expect(lettersTaughtThrough(idx, last).size).toBe(35);
  });

  it('flags a word that uses a letter not taught yet', () => {
    const b = realBundle();
    const first = b.lessons.find((l) => l.id === 's1-l1')!;
    first.words.push('kafsh');
    const errs = validateContent(b).filter((i) => i.level === 'error');
    expect(errs.some((e) => e.where === 'lesson "s1-l1"' && e.message.includes('кафш'))).toBe(true);
  });

  it('flags Latin lookalikes typed into Cyrillic words', () => {
    const b = realBundle();
    b.words[0] = { ...b.words[0]!, cyrillic: 'нoн' }; // Latin "o"
    const errs = validateContent(b).filter((i) => i.level === 'error');
    expect(errs.some((e) => e.message.includes('unknown characters'))).toBe(true);
  });

  it('splits letters including Tajik-only ones', () => {
    const idx = realIndex();
    expect(uniqueLetters('Тоҷикистон', idx.letterByChar)).toEqual(['t', 'o', 'j', 'i', 'k', 's', 'n']);
  });

  it('the first lesson is s1-l1 and the next one follows completion', () => {
    const idx = realIndex();
    expect(nextLesson(idx, [])?.id).toBe('s1-l1');
    expect(nextLesson(idx, ['s1-l1'])?.id).toBe('s1-l2');
  });
});
