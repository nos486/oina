import { describe, expect, it } from 'vitest';
import {
  DAY_MS, HEART_REFILL_MS, addXp, awardBadges, canStartLesson, levelForXp, levelInfo, totalStars, xpForLevel, completeLesson, completeStageTest, createProgress,
  currentStreak, gainHeart, loseHeart, mergeProgress, nextHeartIn, nextLevel, normalizeProgress, refillHearts, starsForScore,
} from '../src/index.js';
import { T0, later, realIndex } from './fixtures.js';

describe('xp and streak', () => {
  it('counts a streak day only after the daily goal', () => {
    let p = addXp(createProgress(T0), 10, T0);
    expect(p.streak.count).toBe(0);
    p = addXp(p, 10, T0);
    expect(p.streak.count).toBe(1);
    p = addXp(p, 20, later(T0, DAY_MS));
    expect(p.streak.count).toBe(2);
    expect(p.xp).toBe(40);
  });

  it('resets after a missed day', () => {
    const p = addXp(createProgress(T0), 20, T0);
    const t2 = later(T0, 2 * DAY_MS);
    expect(currentStreak(p, later(T0, DAY_MS))).toBe(1);
    expect(currentStreak(p, t2)).toBe(0);
    expect(addXp(p, 20, t2).streak.count).toBe(1);
  });
});

describe('hearts', () => {
  it('lose one per mistake and refill one every 30 minutes', () => {
    let p = createProgress(T0);
    for (let i = 0; i < 5; i++) p = loseHeart(p, T0);
    expect(p.hearts.count).toBe(0);
    expect(canStartLesson(p, T0)).toBe(false);
    expect(nextHeartIn(p, T0)).toBe(HEART_REFILL_MS);
    p = refillHearts(p, later(T0, HEART_REFILL_MS * 2 + 1000));
    expect(p.hearts.count).toBe(2);
    p = gainHeart(p);
    expect(p.hearts.count).toBe(3);
  });

  it('can be turned off in settings', () => {
    const p = { ...createProgress(T0), settings: { ...createProgress(T0).settings, hearts: false } };
    expect(loseHeart(p, T0).hearts.count).toBe(5);
  });
});

describe('lessons, stars, shop', () => {
  it('tracks lesson level and stars', () => {
    let p = completeLesson(createProgress(T0), 's1-l1', 1);
    expect(nextLevel(p, 's1-l1')).toBe(2);
    expect(totalStars(p)).toBe(1);
    p = completeLesson(p, 's1-l1', 3);
    expect(totalStars(p)).toBe(3);
    expect(nextLevel(p, 's1-l1')).toBe(3);
    expect(p.completedLessons).toEqual(['s1-l1']);
  });

  it('gives stage stars at 80/90/100% and passing tests out the stage', () => {
    expect([0.79, 0.8, 0.9, 1].map(starsForScore)).toEqual([0, 1, 2, 3]);
    const idx = realIndex();
    const p = completeStageTest(createProgress(T0), idx, 1, 0.93);
    expect(p.stageStars[1]).toBe(2);
    expect(p.completedLessons).toEqual(['s1-l1', 's1-l2', 's1-l3']);
  });

  it('turns XP into levels', () => {
    expect([0, 49, 50, 199, 200, 450].map(levelForXp)).toEqual([1, 1, 2, 2, 3, 4]);
    expect(xpForLevel(5)).toBe(800);
    expect(levelInfo(125)).toEqual({ level: 2, current: 50, next: 200, fraction: 0.5 });
  });

  it('awards badges once', () => {
    const idx = realIndex();
    const p = completeLesson(createProgress(T0), 's1-l1', 1);
    const r = awardBadges(p, idx, T0);
    expect(r.earned).toEqual(['first-word']);
    expect(awardBadges(r.progress, idx, T0).earned).toEqual([]);
  });
});

describe('progress storage', () => {
  it('normalizes garbage and old data to a valid progress', () => {
    expect(normalizeProgress(null, T0)).toEqual(createProgress(T0));
    const p = normalizeProgress({ version: 1, xp: 50, hearts: { count: 99 }, settings: { sound: false } }, T0);
    expect(p.xp).toBe(50);
    expect(p.hearts.count).toBe(5);
    expect(p.settings.sound).toBe(false);
    expect(p.settings.track).toBe('tg');
  });

  it('merges two devices with "most progress wins"', () => {
    const a = { ...completeLesson(createProgress(T0), 's1-l1', 2), xp: 100 };
    const b = { ...completeLesson(createProgress(T0), 's1-l2', 1), xp: 40 };
    const m = mergeProgress(a, b);
    expect(m.completedLessons.sort()).toEqual(['s1-l1', 's1-l2']);
    expect(m.xp).toBe(100);
    expect(m.lessonLevels).toEqual({ 's1-l1': 2, 's1-l2': 1 });
  });
});
