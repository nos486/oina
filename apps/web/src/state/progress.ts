import { useSyncExternalStore } from 'react';
import type { Progress } from '@oina/shared';
import { PROGRESS_STORAGE_KEY } from '@oina/shared';
import { createProgress, normalizeProgress, refillHearts } from '@oina/engine';
import { storage } from '../lib/storage';

function load(): Progress {
  const raw = storage.get(PROGRESS_STORAGE_KEY);
  if (!raw) return createProgress();
  try {
    return refillHearts(normalizeProgress(JSON.parse(raw)), new Date());
  } catch {
    return createProgress();
  }
}

let state: Progress = load();
/** UI subscribers: told about every change. */
const listeners = new Set<() => void>();
/** Change subscribers (account sync): told only about changes made on this device. */
const changeListeners = new Set<() => void>();

function emit(silent = false) {
  storage.set(PROGRESS_STORAGE_KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
  if (!silent) changeListeners.forEach((l) => l());
}

export const progressStore = {
  get: () => state,
  /** Apply a pure engine update and persist it. */
  update(fn: (p: Progress) => Progress) {
    const next = fn(state);
    if (next !== state) {
      state = next;
      emit();
    }
  },
  /** silent: the change came from the server, so do not push it back. */
  replace(p: Progress, opts: { silent?: boolean } = {}) {
    state = p;
    emit(opts.silent);
  },
  reset() {
    state = { ...createProgress(), onboarded: true, settings: state.settings };
    emit(true);
  },
  subscribe(l: () => void, opts: { includeSilent?: boolean } = {}) {
    const set = opts.includeSilent === false ? changeListeners : listeners;
    set.add(l);
    return () => {
      set.delete(l);
    };
  },
  exportJson: () => JSON.stringify(state, null, 2),
  importJson(text: string): boolean {
    try {
      const parsed = JSON.parse(text);
      if (parsed?.version !== 1) return false;
      state = normalizeProgress(parsed);
      emit();
      return true;
    } catch {
      return false;
    }
  },
};

// Keep tabs in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === PROGRESS_STORAGE_KEY) {
      state = load();
      listeners.forEach((l) => l());
    }
  });
}

export function useProgress(): Progress {
  return useSyncExternalStore(progressStore.subscribe, progressStore.get, progressStore.get);
}
