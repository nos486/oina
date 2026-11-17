/**
 * Client side of sign-in. The token comes from the Worker (password login now, Google later)
 * and is sent as a Bearer token. Signing in is optional; the app works without an account.
 */
import { useSyncExternalStore } from 'react';
import type { AdminStats, AuthUser, LoginResponse } from '@oina/shared';
import { API_BASE } from './config';
import { storage } from './storage';

const KEY = 'session:v1';

interface Session {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

function load(): Session | null {
  try {
    const s = JSON.parse(storage.get(KEY) ?? 'null') as Session | null;
    return s && Date.parse(s.expiresAt) > Date.now() ? s : null;
  } catch {
    return null;
  }
}

let session = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function save(s: Session | null) {
  session = s;
  if (s) storage.set(KEY, JSON.stringify(s));
  else storage.remove(KEY);
  emit();
}

export class AuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (session) headers.set('Authorization', `Bearer ${session.token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401 && session) save(null);
  if (!res.ok) throw new AuthError(`HTTP ${res.status}`, res.status);
  return (await res.json()) as T;
}

export const auth = {
  get: () => session,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  async login(username: string, password: string): Promise<AuthUser> {
    const r = await call<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    save({ token: r.token, expiresAt: r.expiresAt, user: r.user });
    return r.user;
  },
  logout() {
    void call('/auth/logout', { method: 'POST' }).catch(() => undefined);
    save(null);
  },
  me: () => call<{ user: AuthUser; defaultPassword: boolean }>('/auth/me'),
  adminStats: () => call<AdminStats>('/admin/stats'),
};

export function useSession(): Session | null {
  return useSyncExternalStore(auth.subscribe, auth.get, auth.get);
}

export const isAdmin = (s: Session | null) => !!s?.user.roles.includes('admin');
