/** XP, daily goal, streak, hearts, gems, stars and badges. Pure functions over Progress. */
import type { Progress } from '@oina/shared';
import type { ContentIndex } from './content-index.js';
import { dayKey, daysBetween } from './time.js';
import { MAX_HEARTS, letterKey, wordKey } from './progress.js';
import { effectiveStrength } from './review-engine.js';

export const HEART_REFILL_MS = 30 * 60 * 1000;
export const GEMS_PER_LESSON = 5;
export const GEMS_PERFECT_BONUS = 5;
export const STREAK_FREEZE_PRICE = 50;
export const HEART_REFILL_PRICE = 30;
export const STAGE_TEST_PASS = 0.8;

export function xpToday(progress: Progress, now: Date): number {
  return progress.xpByDay[dayKey(now)] ?? 0;
}

/**
 * Adds XP and updates the streak. The streak counts a day once the daily goal is reached.
 * Missed days are covered by streak freezes when the user has enough of them.
 */
export function addXp(progress: Progress, amount: number, now: Date): Progress {
  if (amount <= 0) return progress;
  const today = dayKey(now);
  const todayXp = (progress.xpByDay[today] ?? 0) + amount;
  let { streak, streakFreezes } = progress;
  if (todayXp >= progress.dailyGoal && streak.lastDay !== today) {
    const gap = streak.lastDay ? daysBetween(streak.lastDay, today) : Infinity;
    if (gap === 1) streak = { count: streak.count + 1, lastDay: today };
    else if (gap !== Infinity && gap - 1 <= streakFreezes) {
      streakFreezes -= gap - 1;
      streak = { count: streak.count + 1, lastDay: today };
    } else streak = { count: 1, lastDay: today };
  }
  return { ...progress, xp: progress.xp + amount, xpByDay: { ...progress.xpByDay, [today]: todayXp }, streak, streakFreezes };
}

/** The streak shown in the UI: 0 if the user missed more days than freezes can cover. */
export function currentStreak(progress: Progress, now: Date): number {
  const { lastDay, count } = progress.streak;
  if (!lastDay) return 0;
  const gap = daysBetween(lastDay, dayKey(now));
  return gap <= 1 + progress.streakFreezes ? count : 0;
}

/** +1 heart for every 30 minutes since the last refill. */
export function refillHearts(progress: Progress, now: Date): Progress {
  const { count, lastRefill } = progress.hearts;
  if (count >= MAX_HEARTS) return { ...progress, hearts: { count: MAX_HEARTS, lastRefill: now.toISOString() } };
  const elapsed = now.getTime() - Date.parse(lastRefill);
  const gained = Math.floor(elapsed / HEART_REFILL_MS);
  if (gained <= 0) return progress;
  const next = Math.min(MAX_HEARTS, count + gained);
  const refillAt = next >= MAX_HEARTS ? now.getTime() : Date.parse(lastRefill) + gained * HEART_REFILL_MS;
  return { ...progress, hearts: { count: next, lastRefill: new Date(refillAt).toISOString() } };
}

/** Milliseconds until the next heart, or null when full. */
export function nextHeartIn(progress: Progress, now: Date): number | null {
  if (progress.hearts.count >= MAX_HEARTS) return null;
  return Math.max(0, Date.parse(progress.hearts.lastRefill) + HEART_REFILL_MS - now.getTime());
}

export function loseHeart(progress: Progress, now: Date): Progress {
  if (!progress.settings.hearts) return progress;
  const p = refillHearts(progress, now);
  const wasFull = p.hearts.count >= MAX_HEARTS;
  return { ...p, hearts: { count: Math.max(0, p.hearts.count - 1), lastRefill: wasFull ? now.toISOString() : p.hearts.lastRefill } };
}

/** A correct answer in review earns a heart back. Review never costs hearts. */
export function gainHeart(progress: Progress): Progress {
  return { ...progress, hearts: { ...progress.hearts, count: Math.min(MAX_HEARTS, progress.hearts.count + 1) } };
}

export function canStartLesson(progress: Progress, now: Date): boolean {
  return !progress.settings.hearts || refillHearts(progress, now).hearts.count > 0;
}

export function completeLesson(progress: Progress, lessonId: string, level: 1 | 2 | 3, perfect: boolean): Progress {
  const prevLevel = progress.lessonLevels[lessonId] ?? 0;
  return {
    ...progress,
    completedLessons: progress.completedLessons.includes(lessonId) ? progress.completedLessons : [...progress.completedLessons, lessonId],
    lessonLevels: { ...progress.lessonLevels, [lessonId]: Math.max(prevLevel, level) as 0 | 1 | 2 | 3 },
    gems: progress.gems + GEMS_PER_LESSON + (perfect ? GEMS_PERFECT_BONUS : 0),
  };
}

/** Next level to play for a lesson (1..3); 3 stays 3 for replays. */
export function nextLevel(progress: Progress, lessonId: string): 1 | 2 | 3 {
  return Math.min(3, (progress.lessonLevels[lessonId] ?? 0) + 1) as 1 | 2 | 3;
}

export function starsForScore(score: number): 0 | 1 | 2 | 3 {
  if (score >= 1) return 3;
  if (score >= 0.9) return 2;
  if (score >= STAGE_TEST_PASS) return 1;
  return 0;
}

/** Records a stage test. Passing also marks every lesson of the stage done ("test out"). */
export function completeStageTest(progress: Progress, index: ContentIndex, stageId: number, score: number): Progress {
  const stars = starsForScore(score);
  const prev = progress.stageStars[stageId] ?? 0;
  let p: Progress = { ...progress, stageStars: { ...progress.stageStars, [stageId]: Math.max(prev, stars) as 0 | 1 | 2 | 3 } };
  if (stars > 0) {
    const lessons = index.stageById.get(stageId)?.lessons ?? [];
    p = { ...p, completedLessons: [...new Set([...p.completedLessons, ...lessons])], gems: p.gems + 10 * stars };
  }
  return p;
}

export function buy(progress: Progress, what: 'streakFreeze' | 'hearts'): Progress | null {
  const price = what === 'streakFreeze' ? STREAK_FREEZE_PRICE : HEART_REFILL_PRICE;
  if (progress.gems < price) return null;
  if (what === 'streakFreeze') return { ...progress, gems: progress.gems - price, streakFreezes: progress.streakFreezes + 1 };
  return { ...progress, gems: progress.gems - price, hearts: { count: MAX_HEARTS, lastRefill: new Date().toISOString() } };
}

export interface BadgeDef {
  id: string;
  titleFa: string;
  descriptionFa: string;
  earned: (p: Progress, index: ContentIndex, now: Date) => boolean;
}

const alphabetLessons = (index: ContentIndex) => index.stages.filter((s) => s.id <= 6).flatMap((s) => s.lessons);

export const BADGES: BadgeDef[] = [
  { id: 'first-word', titleFa: 'اولین کلمه', descriptionFa: 'اولین درس را تمام کردی', earned: (p) => p.completedLessons.length >= 1 },
  {
    id: 'words-100',
    titleFa: '۱۰۰ کلمه',
    descriptionFa: '۱۰۰ کلمه را درست خواندی',
    earned: (p) => Object.entries(p.items).filter(([k, v]) => k.startsWith('word:') && v.correct > 0).length >= 100,
  },
  {
    id: 'trap-hunter',
    titleFa: 'شکارچی فریبکار',
    descriptionFa: 'همه‌ی حرف‌های فریبکار را محکم یاد گرفتی',
    earned: (p, index, now) =>
      index.letters.filter((l) => l.category === 'trap').every((l) => effectiveStrength(p.items[letterKey(l.id)], now) >= 60),
  },
  {
    id: 'alphabet-done',
    titleFa: 'الفبا تمام',
    descriptionFa: 'همه‌ی شش مرحله‌ی الفبا را تمام کردی',
    earned: (p, index) => {
      const all = alphabetLessons(index);
      return all.length > 0 && all.every((id) => p.completedLessons.includes(id));
    },
  },
  { id: 'streak-7', titleFa: 'هفت روز پیاپی', descriptionFa: 'هفت روز پشت سر هم هدف روزانه را زدی', earned: (p) => p.streak.count >= 7 },
  {
    id: 'tajikistan',
    titleFa: 'Тоҷикистон',
    descriptionFa: 'کلمه‌ی «Тоҷикистон» را خواندی',
    earned: (p) => (p.items[wordKey('tojikiston')]?.correct ?? 0) > 0,
  },
];

/** Adds newly earned badges. Returns the progress and the ids that were just earned. */
export function awardBadges(progress: Progress, index: ContentIndex, now: Date): { progress: Progress; earned: string[] } {
  const earned = BADGES.filter((b) => !progress.badges.includes(b.id) && b.earned(progress, index, now)).map((b) => b.id);
  return earned.length ? { progress: { ...progress, badges: [...progress.badges, ...earned] }, earned } : { progress, earned };
}
