/**
 * A lesson/review session as a pure state machine.
 * A wrong answer sends the item to the end of the queue in another exercise form;
 * the session ends once every question has been answered correctly once.
 */
import type { ItemKey } from '@oina/shared';
import type { Ctx, Grade, Question, Response } from './exercises.js';
import { grade, questionForItem } from './exercises.js';

export type SessionMode = 'lesson' | 'review' | 'mistakes' | 'stageTest';

export const XP_PER_CORRECT = 10;
export const XP_PERFECT_BONUS = 15;
export const COMBO_LENGTH = 5;
/** Max times one item is re-queued, so a session always ends. */
export const MAX_RETRIES_PER_ITEM = 2;

export interface SessionState {
  mode: SessionMode;
  queue: Question[];
  position: number;
  level: 1 | 2 | 3;
  /** Answers given (including retries). */
  answered: number;
  correctCount: number;
  wrongCount: number;
  combo: number;
  bestCombo: number;
  xp: number;
  retries: Record<string, number>;
  /** Item keys answered wrong at least once in this session. */
  missed: ItemKey[];
  /** Number of distinct questions at the start (for the progress bar). */
  initialCount: number;
  /** Stage test: first-try results only. */
  firstTry: { correct: number; total: number };
  done: boolean;
}

export interface AnswerOutcome {
  state: SessionState;
  grade: Grade;
  /** XP earned by this answer. */
  xp: number;
  comboActive: boolean;
}

export function startSession(mode: SessionMode, questions: Question[], level: 1 | 2 | 3 = 1): SessionState {
  return {
    mode,
    queue: questions,
    position: 0,
    level,
    answered: 0,
    correctCount: 0,
    wrongCount: 0,
    combo: 0,
    bestCombo: 0,
    xp: 0,
    retries: {},
    missed: [],
    initialCount: questions.length,
    firstTry: { correct: 0, total: 0 },
    done: questions.length === 0,
  };
}

export function currentQuestion(s: SessionState): Question | undefined {
  return s.done ? undefined : s.queue[s.position];
}

/** 0..1 for the progress bar: share of the queue already cleared. */
export function sessionProgress(s: SessionState): number {
  if (s.done) return 1;
  return s.queue.length ? s.position / s.queue.length : 1;
}

export function answer(s: SessionState, response: Response, ctx: Ctx): AnswerOutcome {
  const q = currentQuestion(s);
  if (!q) throw new Error('session is finished');
  const g = grade(q, response);
  const isRetry = s.position >= s.initialCount;
  const queue = [...s.queue];
  let combo = s.combo;
  let xp = 0;
  const missed = [...s.missed];
  const retries = { ...s.retries };

  if (g.correct) {
    combo += 1;
    xp = combo >= COMBO_LENGTH ? XP_PER_CORRECT * 2 : XP_PER_CORRECT;
  } else {
    combo = 0;
    for (const it of g.items) if (!it.correct && !missed.includes(it.itemKey)) missed.push(it.itemKey);
    // Stage tests do not repeat questions; lessons and reviews do.
    if (s.mode !== 'stageTest' && q.type !== 'match') {
      const n = (retries[q.itemKey] ?? 0) + 1;
      retries[q.itemKey] = n;
      if (n <= MAX_RETRIES_PER_ITEM) {
        const again = questionForItem(ctx, q.itemKey, s.level, q.type) ?? q;
        queue.push(again);
      }
    }
  }
  const position = s.position + 1;
  const done = position >= queue.length;
  let total = s.xp + xp;
  if (done && s.mode === 'lesson' && s.wrongCount === 0 && g.correct) total += XP_PERFECT_BONUS;
  const state: SessionState = {
    ...s,
    queue,
    position,
    answered: s.answered + 1,
    correctCount: s.correctCount + (g.correct ? 1 : 0),
    wrongCount: s.wrongCount + (g.correct ? 0 : 1),
    combo,
    bestCombo: Math.max(s.bestCombo, combo),
    xp: total,
    retries,
    missed,
    firstTry: isRetry ? s.firstTry : { correct: s.firstTry.correct + (g.correct ? 1 : 0), total: s.firstTry.total + 1 },
    done,
  };
  return { state, grade: g, xp: total - s.xp, comboActive: combo >= COMBO_LENGTH };
}

/** Share of first-try answers that were correct (0..1). */
export function accuracy(s: SessionState): number {
  return s.firstTry.total ? s.firstTry.correct / s.firstTry.total : 0;
}
