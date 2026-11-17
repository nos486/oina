import { describe, expect, it } from 'vitest';
import type { Question } from '../src/index.js';
import * as engine from '../src/index.js';
import {
  applyAnswer, contextFor, createProgress, createRng, generateLessonQuestions, generateReviewQuestions,
  generateStageTest, grade, letterKey, lettersTaughtThrough, uniqueLetters, wordKey,
} from '../src/index.js';
import { T0, realIndex } from './fixtures.js';

const idx = realIndex();

function cyrTexts(q: Question): string[] {
  if (q.type === 'match') return q.pairs.map((p) => p.cyr);
  if (q.type === 'buildWord') return q.tiles.map((t) => t.label);
  return [...(q.prompt.script === 'cyr' ? [q.prompt.text] : []), ...q.options.filter((o) => o.script === 'cyr').map((o) => o.label)];
}

describe('lesson generation', () => {
  for (const level of [1, 2, 3] as const) {
    it(`never shows untaught letters (level ${level}, every lesson)`, () => {
      for (const lesson of idx.lessonOrder) {
        const qs = generateLessonQuestions(idx, lesson, createProgress(T0), { rng: createRng(7), now: T0, level });
        const known = lettersTaughtThrough(idx, lesson.id);
        for (const q of qs) for (const t of cyrTexts(q)) {
          for (const l of uniqueLetters(t, idx.letterByChar)) expect(known.has(l), `${lesson.id} ${q.type} "${t}"`).toBe(true);
        }
      }
    });
  }

  it('produces about 10 questions, easy to hard, every choice has 1 right answer', () => {
    const lesson = idx.lessonById.get('s2-l1')!;
    const qs = generateLessonQuestions(idx, lesson, createProgress(T0), { rng: createRng(1), now: T0, level: 1 });
    expect(qs.length).toBeGreaterThanOrEqual(8);
    expect(qs.length).toBeLessThanOrEqual(12);
    expect(qs[0]!.type === 'spotTrap' || qs[0]!.type === 'letterToSound').toBe(true);
    for (const q of qs) {
      if (q.type === 'match' || q.type === 'buildWord') continue;
      expect(q.options.filter((o) => o.id === q.correctId)).toHaveLength(1);
      expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
      expect(q.options.length === 4 || q.type === 'spotTrap').toBe(true); // s2-l1 knows 7 letters
    }
  });

  it('includes ~30% review of weak items from earlier lessons', () => {
    let p = createProgress(T0);
    for (const w of idx.lessonById.get('s1-l2')!.words) p = applyAnswer(p, { itemKey: wordKey(w), correct: false }, T0);
    const lesson = idx.lessonById.get('s2-l1')!;
    const qs = generateLessonQuestions(idx, lesson, p, { rng: createRng(3), now: T0, level: 1 });
    const earlier = new Set(idx.lessonById.get('s1-l2')!.words.map(wordKey));
    const review = qs.filter((q) => earlier.has(q.itemKey));
    expect(review.length).toBe(3);
  });

  it('uses build-word and match questions at level 3', () => {
    const qs = generateLessonQuestions(idx, idx.lessonById.get('s3-l3')!, createProgress(T0), { rng: createRng(5), now: T0, level: 3 });
    const types = new Set(qs.map((q) => q.type));
    expect(types.has('buildWord')).toBe(true);
    expect(types.has('match')).toBe(true);
  });

  it('is reproducible with the same seed', () => {
    const lesson = idx.lessonById.get('s4-l1')!;
    const strip = (qs: Question[]) => qs.map((q) => ({ ...q, id: '' }));
    const a = generateLessonQuestions(idx, lesson, createProgress(T0), { rng: createRng(42), now: T0, level: 2 });
    const b = generateLessonQuestions(idx, lesson, createProgress(T0), { rng: createRng(42), now: T0, level: 2 });
    expect(strip(a)).toEqual(strip(b));
  });
});

describe('distractors', () => {
  it('prefers hand-picked lookalike words for read-word', () => {
    const ctx = contextFor(idx, createProgress(T0), createRng(1), 's4-l1');
    const qs = generateReviewQuestions(idx, createProgress(T0), [wordKey('kafsh')], createRng(2));
    const q = qs[0]!;
    expect(q.type === 'readWord' || q.type === 'buildWord').toBe(true);
    if (q.type === 'readWord') expect(q.options.map((o) => o.label).sort()).toEqual(['کاش', 'کشف', 'کف', 'کفش'].sort());
    expect(ctx.knownLetters.has('sh')).toBe(true);
  });

  it('uses past confusions as wrong options', () => {
    let p = createProgress(T0);
    p = applyAnswer(p, { itemKey: letterKey('r'), correct: false, chosen: 'ژ' }, T0);
    const ctx = contextFor(idx, p, createRng(9), 's2-l1');
    const q = engine.letterToSound(ctx, idx.letterById.get('r')!);
    expect(q.options.map((o) => o.label)).toContain('ژ');
    expect(q.options.map((o) => o.label)).toContain('پ'); // lookalike P
  });
});

describe('grading', () => {
  it('grades choices and records the wrong pick', () => {
    const ctx = contextFor(idx, createProgress(T0), createRng(1), 's2-l1');
    const q = engine.letterToSound(ctx, idx.letterById.get('r')!);
    expect(grade(q, { type: 'choice', optionId: 'ر' }).correct).toBe(true);
    const wrong = q.options.find((o) => o.id !== 'ر')!;
    const g = grade(q, { type: 'choice', optionId: wrong.id });
    expect(g.correct).toBe(false);
    expect(g.items[0]).toEqual({ itemKey: 'letter:r', correct: false, chosen: wrong.label });
  });

  it('grades build-word by letter order', () => {
    const ctx = contextFor(idx, createProgress(T0), createRng(1), 's4-l1');
    const q = engine.buildWord(ctx, idx.wordById.get('kafsh')!)!;
    expect(q.answer).toEqual(['к', 'а', 'ф', 'ш']);
    expect(q.tiles.length).toBe(6);
    expect(grade(q, { type: 'build', labels: ['к', 'а', 'ф', 'ш'] }).correct).toBe(true);
    expect(grade(q, { type: 'build', labels: ['к', 'а', 'ш', 'ф'] }).correct).toBe(false);
  });

  it('grades match boards per pair', () => {
    const ctx = contextFor(idx, createProgress(T0), createRng(1), 's1-l3');
    const words = idx.lessonById.get('s1-l3')!.words.map((id) => idx.wordById.get(id)!);
    const q = engine.match(ctx, words)!;
    expect(q.pairs).toHaveLength(5);
    const g = grade(q, { type: 'match', wrongPairs: [{ pairId: q.pairs[0]!.id, chosenFa: q.pairs[1]!.fa }] });
    expect(g.correct).toBe(false);
    expect(g.items.filter((i) => !i.correct)).toHaveLength(1);
  });
});

describe('stage test', () => {
  it('makes 15 questions from the stage', () => {
    const qs = generateStageTest(idx, 2, createProgress(T0), createRng(4));
    expect(qs).toHaveLength(15);
    const known = lettersTaughtThrough(idx, 's2-l4');
    for (const q of qs) for (const t of cyrTexts(q)) for (const l of uniqueLetters(t, idx.letterByChar)) expect(known.has(l)).toBe(true);
  });
});
