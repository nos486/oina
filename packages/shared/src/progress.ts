import type { Lang } from './content.js';

/** Key of a learnable item: "letter:sha" or "word:kafsh". */
export type ItemKey = `letter:${string}` | `word:${string}`;

export type LeitnerBox = 1 | 2 | 3 | 4 | 5;

export interface ItemState {
  /** 0..100, stored value at `lastSeen`; decays over time (see engine). */
  strength: number;
  box: LeitnerBox;
  /** ISO date-time when the item is due for review. */
  due: string;
  correct: number;
  wrong: number;
  /** ISO date-time. */
  lastSeen: string;
  /** Consecutive correct answers; used to leave the "my mistakes" list. */
  streak: number;
}

export interface Settings {
  track: Lang | 'both';
  sound: boolean;
  /** 'system' follows the OS. */
  theme: 'system' | 'light' | 'dark';
  fontScale: number;
  hearts: boolean;
}

export type DailyGoal = 20 | 50 | 100;

/** Stored in localStorage under PROGRESS_STORAGE_KEY. Later synced via PUT /api/v1/progress. */
export interface Progress {
  version: 1;
  onboarded: boolean;
  completedLessons: string[];
  stageStars: Record<number, 0 | 1 | 2 | 3>;
  items: Record<string, ItemState>;
  /** "Р>پ": 3 — user picked پ when the answer was Р. */
  confusions: Record<string, number>;
  /** Up to 20 item keys, newest first. */
  recentMistakes: string[];
  lessonLevels: Record<string, 0 | 1 | 2 | 3>;
  hearts: { count: number; lastRefill: string };
  gems: number;
  dailyGoal: DailyGoal;
  /** "2026-11-17": 120 */
  xpByDay: Record<string, number>;
  badges: string[];
  streakFreezes: number;
  xp: number;
  streak: { count: number; lastDay: string };
  settings: Settings;
}

export const PROGRESS_STORAGE_KEY = 'progress:v1';
