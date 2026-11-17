/**
 * Smart review (design doc, "مرور هوشمند"). Pure functions over Progress; no I/O, no clock.
 *
 * - Item strength 0..100: correct +15 (+20 when fast), wrong −25, slow decay over time.
 * - Leitner boxes 1..5 with intervals 1, 2, 4, 7, 14 days; wrong → back to box 1.
 * - Confusion pairs: "letter:r>پ" counts how often the user picked پ for Р.
 * - Recent mistakes: last 20 wrong items; an item leaves after 2 correct answers in a row.
 * - Daily review priority = (100 − strength) + 10 × days overdue + 5 × confusions.
 */
import type { ItemKey, ItemState, LeitnerBox, Progress } from '@oina/shared';
import { DAY_MS } from './time.js';
import { MAX_RECENT_MISTAKES } from './progress.js';

export const LEITNER_INTERVAL_DAYS: Record<LeitnerBox, number> = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 14 };
/** Strength lost per day since last seen, by box (low boxes fade faster). */
export const DECAY_PER_DAY: Record<LeitnerBox, number> = { 1: 3, 2: 3, 3: 2, 4: 1, 5: 0.5 };
export const STRENGTH_CORRECT = 15;
export const STRENGTH_CORRECT_FAST = 20;
export const STRENGTH_WRONG = -25;
/** Answers faster than this count as "fast". */
export const FAST_ANSWER_MS = 3000;
export const WEAK_THRESHOLD = 50;

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function newItemState(now: Date): ItemState {
  const iso = now.toISOString();
  return { strength: 0, box: 1, due: iso, correct: 0, wrong: 0, lastSeen: iso, streak: 0 };
}

/** Strength right now, including decay since the item was last seen. */
export function effectiveStrength(item: ItemState | undefined, now: Date): number {
  if (!item) return 0;
  const days = Math.max(0, (now.getTime() - Date.parse(item.lastSeen)) / DAY_MS);
  return clamp(item.strength - DECAY_PER_DAY[item.box] * days);
}

export function isDue(item: ItemState, now: Date): boolean {
  return Date.parse(item.due) <= now.getTime();
}

export interface AnswerInput {
  itemKey: ItemKey;
  correct: boolean;
  /** Milliseconds the user took; used for the "fast" bonus. */
  elapsedMs?: number;
  /** What the user picked when wrong (a Persian label or another item key). */
  chosen?: string;
}

/** Records one answer for one item. Returns a new Progress (input is not mutated). */
export function applyAnswer(progress: Progress, input: AnswerInput, now: Date): Progress {
  const prev = progress.items[input.itemKey];
  const item: ItemState = { ...(prev ?? newItemState(now)) };
  const base = effectiveStrength(prev, now);
  const isNew = !prev;
  const wasDue = isNew || isDue(item, now);

  if (input.correct) {
    const fast = input.elapsedMs !== undefined && input.elapsedMs < FAST_ANSWER_MS;
    item.strength = clamp(base + (fast ? STRENGTH_CORRECT_FAST : STRENGTH_CORRECT));
    item.correct += 1;
    item.streak += 1;
    // Promote only once per due period, so repeating an item inside one lesson
    // does not rush it to box 5.
    if (wasDue) {
      item.box = (isNew ? 1 : Math.min(5, item.box + 1)) as LeitnerBox;
      item.due = new Date(now.getTime() + LEITNER_INTERVAL_DAYS[item.box] * DAY_MS).toISOString();
    }
  } else {
    item.strength = clamp(base + STRENGTH_WRONG);
    item.wrong += 1;
    item.streak = 0;
    item.box = 1;
    item.due = now.toISOString();
  }
  item.lastSeen = now.toISOString();

  let recentMistakes = progress.recentMistakes;
  let confusions = progress.confusions;
  if (!input.correct) {
    recentMistakes = [input.itemKey, ...recentMistakes.filter((k) => k !== input.itemKey)].slice(0, MAX_RECENT_MISTAKES);
    if (input.chosen) {
      const key = confusionKey(input.itemKey, input.chosen);
      confusions = { ...confusions, [key]: (confusions[key] ?? 0) + 1 };
    }
  } else if (item.streak >= 2 && recentMistakes.includes(input.itemKey)) {
    recentMistakes = recentMistakes.filter((k) => k !== input.itemKey);
  }

  return { ...progress, items: { ...progress.items, [input.itemKey]: item }, recentMistakes, confusions };
}

export const confusionKey = (itemKey: string, chosen: string) => `${itemKey}>${chosen}`;

/** Total confusions recorded for an item. */
export function confusionCount(progress: Progress, itemKey: string): number {
  let n = 0;
  const prefix = `${itemKey}>`;
  for (const [k, v] of Object.entries(progress.confusions)) if (k.startsWith(prefix)) n += v;
  return n;
}

/** What the user most often confuses this item with, most frequent first. */
export function topConfusions(progress: Progress, itemKey: string, limit = 3): string[] {
  const prefix = `${itemKey}>`;
  return Object.entries(progress.confusions)
    .filter(([k]) => k.startsWith(prefix))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k.slice(prefix.length));
}

export function reviewPriority(progress: Progress, itemKey: string, now: Date): number {
  const item = progress.items[itemKey];
  if (!item) return 0;
  const overdueDays = Math.max(0, (now.getTime() - Date.parse(item.due)) / DAY_MS);
  return 100 - effectiveStrength(item, now) + 10 * overdueDays + 5 * confusionCount(progress, itemKey);
}

/** Items that are due today, highest priority first. */
export function dueItems(progress: Progress, now: Date, filter?: (key: ItemKey) => boolean): ItemKey[] {
  return (Object.keys(progress.items) as ItemKey[])
    .filter((k) => (!filter || filter(k)) && isDue(progress.items[k]!, now))
    .sort((a, b) => reviewPriority(progress, b, now) - reviewPriority(progress, a, now));
}

/** The daily review: up to n due items with the highest priority. */
export function pickDailyReview(progress: Progress, now: Date, n = 10, filter?: (key: ItemKey) => boolean): ItemKey[] {
  return dueItems(progress, now, filter).slice(0, n);
}

/** Weakest seen items among the given keys (for the 30% review share and the end-of-lesson report). */
export function weakestItems(progress: Progress, keys: Iterable<ItemKey>, now: Date, n: number, threshold = 101): ItemKey[] {
  return [...keys]
    .filter((k) => progress.items[k] && effectiveStrength(progress.items[k], now) < threshold)
    .sort((a, b) => reviewPriority(progress, b, now) - reviewPriority(progress, a, now))
    .slice(0, n);
}

/** Average strength of a set of items; unseen items count as 0. */
export function averageStrength(progress: Progress, keys: ItemKey[], now: Date): number {
  if (!keys.length) return 0;
  return keys.reduce((s, k) => s + effectiveStrength(progress.items[k], now), 0) / keys.length;
}

/** "My mistakes" session: items from the last 20 mistakes. */
export function pickMistakes(progress: Progress, n = 10): ItemKey[] {
  return (progress.recentMistakes as ItemKey[]).slice(0, n);
}
