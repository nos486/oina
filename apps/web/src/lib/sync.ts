/**
 * Keeps the signed-in user's progress in D1. localStorage stays the working copy (works offline);
 * the server copy is merged in on sign-in and app start, and every change is pushed shortly after.
 */
import { useSyncExternalStore } from 'react';
import { mergeProgress, normalizeProgress } from '@oina/engine';
import { auth } from './auth';
import { progressStore } from '../state/progress';

export type SyncState = 'off' | 'syncing' | 'synced' | 'pending' | 'error';

const PUSH_DELAY_MS = 1500;

let state: SyncState = auth.get() ? 'pending' : 'off';
let lastSyncedAt: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;
let started = false;
const listeners = new Set<() => void>();

function set(s: SyncState) {
  state = s;
  listeners.forEach((l) => l());
}

async function push(keepalive = false) {
  if (!auth.get()) return;
  dirty = false;
  set('syncing');
  try {
    const r = await auth.putProgress(progressStore.get(), keepalive);
    lastSyncedAt = r.updatedAt;
    set(dirty ? 'pending' : 'synced');
  } catch {
    dirty = true;
    set(auth.get() ? 'error' : 'off');
  }
}

function schedule() {
  if (!auth.get()) return;
  dirty = true;
  set('pending');
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void push(), PUSH_DELAY_MS);
}

/** Pulls the server copy, merges it with this device's copy, and pushes the result back. */
export async function pullAndMerge(): Promise<void> {
  if (!auth.get()) return;
  set('syncing');
  try {
    const r = await auth.getProgress();
    if (r.progress) {
      // This device first, so its unsynced setting changes win a tie.
      const merged = mergeProgress(progressStore.get(), normalizeProgress(r.progress));
      progressStore.replace(merged, { silent: true });
    }
    await push();
  } catch {
    set(auth.get() ? 'error' : 'off');
  }
}

/** Call once at startup. */
export function startSync() {
  if (started) return;
  started = true;
  progressStore.subscribe(schedule, { includeSilent: false });
  window.addEventListener('pagehide', () => {
    if (dirty && auth.get()) void push(true);
  });
  window.addEventListener('online', () => {
    if (dirty) void push();
  });
  if (auth.get()) void pullAndMerge();
}

/** Saves what is left, then signs out and clears this device's copy (it lives in the account now). */
export async function signOut() {
  if (timer) clearTimeout(timer);
  if (dirty) await push();
  auth.clear();
  progressStore.reset();
  dirty = false;
  set('off');
}

/** After login/register on this device. */
export async function onSignedIn() {
  await pullAndMerge();
}

export function useSyncState(): { state: SyncState; lastSyncedAt: string | null } {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  return { state: s, lastSyncedAt };
}
