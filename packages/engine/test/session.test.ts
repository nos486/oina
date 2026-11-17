import { describe, expect, it } from 'vitest';
import type { Question, Response } from '../src/index.js';
import {
  COMBO_LENGTH, XP_PERFECT_BONUS, XP_PER_CORRECT, accuracy, answer, contextFor, createProgress, createRng,
  currentQuestion, generateLessonQuestions, startSession,
} from '../src/index.js';
import { T0, realIndex } from './fixtures.js';

const idx = realIndex();
const lesson = idx.lessonById.get('s2-l1')!;
const ctx = () => contextFor(idx, createProgress(T0), createRng(11), lesson.id);
const questions = () => generateLessonQuestions(idx, lesson, createProgress(T0), { rng: createRng(11), now: T0, level: 1 });

function right(q: Question): Response {
  if (q.type === 'match') return { type: 'match', wrongPairs: [] };
  if (q.type === 'buildWord') return { type: 'build', labels: q.answer };
  return { type: 'choice', optionId: q.correctId };
}
function wrong(q: Question): Response {
  if (q.type === 'match') return { type: 'match', wrongPairs: [{ pairId: q.pairs[0]!.id, chosenFa: q.pairs[1]!.fa }] };
  if (q.type === 'buildWord') return { type: 'build', labels: [...q.answer].reverse() };
  return { type: 'choice', optionId: q.options.find((o) => o.id !== q.correctId)!.id };
}

describe('lesson session', () => {
  it('a perfect run ends with combo XP and the perfect bonus', () => {
    const qs = questions();
    let s = startSession('lesson', qs);
    const c = ctx();
    while (!s.done) s = answer(s, right(currentQuestion(s)!), c).state;
    const n = qs.length;
    const expected = Math.min(n, COMBO_LENGTH - 1) * XP_PER_CORRECT + Math.max(0, n - (COMBO_LENGTH - 1)) * XP_PER_CORRECT * 2;
    expect(s.xp).toBe(expected + XP_PERFECT_BONUS);
    expect(accuracy(s)).toBe(1);
  });

  it('a wrong answer goes to the end of the queue in another form', () => {
    const qs = questions().filter((q) => q.type !== 'match');
    let s = startSession('lesson', qs);
    const first = currentQuestion(s)!;
    s = answer(s, wrong(first), ctx()).state;
    expect(s.queue).toHaveLength(qs.length + 1);
    const retry = s.queue.at(-1)!;
    expect(retry.itemKey).toBe(first.itemKey);
    expect(retry.type).not.toBe(first.type);
    expect(s.combo).toBe(0);
    expect(s.missed).toEqual([first.itemKey]);
  });

  it('only ends when every question was answered right once (with a retry cap)', () => {
    let s = startSession('lesson', questions().slice(0, 3));
    const c = ctx();
    let guard = 0;
    while (!s.done && guard++ < 50) s = answer(s, wrong(currentQuestion(s)!), c).state;
    expect(s.done).toBe(true);
    expect(s.answered).toBeLessThanOrEqual(3 * 3);
  });

  it('stage tests do not repeat questions', () => {
    let s = startSession('stageTest', questions().slice(0, 4));
    const c = ctx();
    while (!s.done) s = answer(s, wrong(currentQuestion(s)!), c).state;
    expect(s.answered).toBe(4);
    expect(accuracy(s)).toBe(0);
  });
});
