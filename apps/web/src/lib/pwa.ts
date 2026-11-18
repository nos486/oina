/** Service worker registration and the "add to home screen" prompt (Android/desktop Chrome). */
import { useSyncExternalStore } from 'react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function startPwa() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline support is optional */
      });
    });
  }
}

export type InstallState = 'installed' | 'available' | 'ios' | 'unavailable';

function snapshot(): InstallState {
  if (installed) return 'installed';
  if (deferred) return 'available';
  if (typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios';
  return 'unavailable';
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot,
    snapshot,
  );
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  emit();
  return outcome === 'accepted';
}
