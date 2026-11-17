import { describe, expect, it } from 'vitest';
import {
  DAY_MS, applyAnswer, averageStrength, confusionCount, createProgress, effectiveStrength, letterKey,
  pickDailyReview, pickMistakes, reviewPriority, topConfusions, weakestItems,
} from '../src/index.js';
import { T0, later } from './fixtures.js';

const k = letterKey('r');

describe('item strength', () => {
  it('rises +15 on a correct answer and +20 when fast', () => {
    const p1 = applyAnswer(createProgress(T0), { itemKey: k, correct: true, elapsedMs: 5000 }, T0);
    expect(p1.items[k]!.strength).toBe(15);
    const p2 = applyAnswer(createProgress(T0), { itemKey: k, correct: true, elapsedMs: 1000 }, T0);
    expect(p2.items[k]!.strength).toBe(20);
  });

  it('drops 25 on a wrong answer and never goes below 0 or above 100', () => {
    let p = createProgress(T0);
    p = applyAnswer(p, { itemKey: k, correct: false }, T0);
    expect(p.items[k]!.strength).toBe(0);
    for (let i = 0; i < 10; i++) p = applyAnswer(p, { itemKey: k, correct: true, elapsedMs: 100 }, T0);
    expect(p.items[k]!.strength).toBe(100);
    p = applyAnswer(p, { itemKey: k, correct: false }, T0);
    expect(p.items[k]!.strength).toBe(75);
  });

  it('decays about 3 points a day in low boxes', () => {
    const p = applyAnswer(createProgress(T0), { itemKey: k, correct: true, elapsedMs: 1000 }, T0);
    expect(effectiveStrength(p.items[k], later(T0, 2 * DAY_MS))).toBeCloseTo(14);
  });

  it('does not mutate the input progress', () => {
    const p0 = createProgress(T0);
    applyAnswer(p0, { itemKey: k, correct: true }, T0);
    expect(p0.items).toEqual({});
  });
});

describe('Leitner boxes', () => {
  it('starts in box 1 and moves up one box per due period', () => {
    let p = applyAnswer(createProgress(T0), { itemKey: k, correct: true }, T0);
    expect(p.items[k]!.box).toBe(1);
    expect(p.items[k]!.due).toBe(later(T0, DAY_MS).toISOString());
    // Answering again the same day does not promote.
    p = applyAnswer(p, { itemKey: k, correct: true }, later(T0, 60_000));
    expect(p.items[k]!.box).toBe(1);
    // Once due, it promotes: box 2 → 2 days.
    const t1 = later(T0, DAY_MS + 1);
    p = applyAnswer(p, { itemKey: k, correct: true }, t1);
    expect(p.items[k]!.box).toBe(2);
    expect(p.items[k]!.due).toBe(later(t1, 2 * DAY_MS).toISOString());
  });

  it('caps at box 5 (14 days)', () => {
    let p = createProgress(T0);
    let t = T0;
    for (let i = 0; i < 8; i++) {
      p = applyAnswer(p, { itemKey: k, correct: true }, t);
      t = later(t, 15 * DAY_MS);
    }
    expect(p.items[k]!.box).toBe(5);
  });

  it('a wrong answer sends the item back to box 1, due now', () => {
    let p = createProgress(T0);
    let t = T0;
    for (let i = 0; i < 4; i++) {
      p = applyAnswer(p, { itemKey: k, correct: true }, t);
      t = later(t, 15 * DAY_MS);
    }
    p = applyAnswer(p, { itemKey: k, correct: false }, t);
    expect(p.items[k]!.box).toBe(1);
    expect(p.items[k]!.due).toBe(t.toISOString());
  });
});

describe('confusions and mistakes', () => {
  it('records which wrong answer was picked', () => {
    let p = applyAnswer(createProgress(T0), { itemKey: k, correct: false, chosen: 'پ' }, T0);
    p = applyAnswer(p, { itemKey: k, correct: false, chosen: 'پ' }, T0);
    p = applyAnswer(p, { itemKey: k, correct: false, chosen: 'ب' }, T0);
    expect(p.confusions['letter:r>پ']).toBe(2);
    expect(confusionCount(p, k)).toBe(3);
    expect(topConfusions(p, k)).toEqual(['پ', 'ب']);
  });

  it('keeps the last 20 mistakes, newest first, without duplicates', () => {
    let p = createProgress(T0);
    for (let i = 0; i < 25; i++) p = applyAnswer(p, { itemKey: letterKey(`x${i}`), correct: false }, T0);
    p = applyAnswer(p, { itemKey: letterKey('x10'), correct: false }, T0);
    expect(p.recentMistakes).toHaveLength(20);
    expect(p.recentMistakes[0]).toBe('letter:x10');
    expect(new Set(p.recentMistakes).size).toBe(20);
    expect(pickMistakes(p, 10)).toHaveLength(10);
  });

  it('removes an item from mistakes after 2 correct answers in a row', () => {
    let p = applyAnswer(createProgress(T0), { itemKey: k, correct: false }, T0);
    p = applyAnswer(p, { itemKey: k, correct: true }, T0);
    expect(p.recentMistakes).toContain(k);
    p = applyAnswer(p, { itemKey: k, correct: true }, T0);
    expect(p.recentMistakes).not.toContain(k);
  });
});

describe('daily review priority', () => {
  it('follows (100 − strength) + 10 × days overdue + 5 × confusions', () => {
    let p = applyAnswer(createProgress(T0), { itemKey: k, correct: true, elapsedMs: 5000 }, T0); // 15, due T0+1d
    p = { ...p, confusions: { 'letter:r>پ': 2 } };
    const now = later(T0, 3 * DAY_MS); // 2 days overdue, decayed 9
    expect(reviewPriority(p, k, now)).toBeCloseTo(100 - 6 + 20 + 10);
  });

  it('picks up to 10 due items, highest priority first', () => {
    let p = createProgress(T0);
    for (let i = 0; i < 15; i++) p = applyAnswer(p, { itemKey: letterKey(`l${i}`), correct: i % 2 === 0 }, T0);
    const now = later(T0, 2 * DAY_MS);
    const picked = pickDailyReview(p, now);
    expect(picked).toHaveLength(10);
    const prios = picked.map((x) => reviewPriority(p, x, now));
    expect([...prios].sort((a, b) => b - a)).toEqual(prios);
    // Not-yet-due items are excluded.
    const fresh = applyAnswer(createProgress(T0), { itemKey: k, correct: true }, T0);
    expect(pickDailyReview(fresh, T0)).toEqual([]);
  });

  it('finds the weakest seen items and averages strength', () => {
    let p = applyAnswer(createProgress(T0), { itemKey: letterKey('a'), correct: true, elapsedMs: 1 }, T0);
    p = applyAnswer(p, { itemKey: letterKey('b'), correct: false }, T0);
    expect(weakestItems(p, [letterKey('a'), letterKey('b'), letterKey('never')], T0, 5)).toEqual(['letter:b', 'letter:a']);
    expect(averageStrength(p, [letterKey('a'), letterKey('b')], T0)).toBe(10);
  });
});
