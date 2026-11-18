/**
 * A lesson left halfway is kept on this device so it can be resumed from the same question.
 * Questions are plain data, so the whole engine SessionState can be stored as JSON.
 */
import { useSyncExternalStore } from 'react';
import type { SessionState } from '@oina/engine';
import { storage } from '../lib/storage';

const KEY = 'session:v1';
/** Older unfinished lessons are dropped: the learner's item strengths have moved on. */
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export interface SavedSession {
  lessonId: string;
  level: 1 | 2 | 3;
  state: SessionState;
  savedAt: string;
}

function read(): SavedSession | null {
  const raw = storage.get(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as SavedSession;
    const fresh = Date.now() - new Date(s.savedAt).getTime() < MAX_AGE_MS;
    if (!fresh || s.state.done || !Array.isArray(s.state.queue) || s.state.answered === 0) return null;
    return s;
  } catch {
    return null;
  }
}

let current = read();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const savedSession = {
  get: () => current,
  /** The saved state for this lesson at this level, if any. */
  forLesson(lessonId: string, level: number): SavedSession | null {
    return current && current.lessonId === lessonId && current.level === level ? current : null;
  },
  save(lessonId: string, level: 1 | 2 | 3, state: SessionState) {
    if (state.done || state.answered === 0) return;
    current = { lessonId, level, state, savedAt: new Date().toISOString() };
    storage.set(KEY, JSON.stringify(current));
    emit();
  },
  clear() {
    if (!current) return;
    current = null;
    storage.remove(KEY);
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useSavedSession(): SavedSession | null {
  return useSyncExternalStore(savedSession.subscribe, savedSession.get, savedSession.get);
}
