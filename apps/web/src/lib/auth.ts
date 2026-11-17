/**
 * Client side of sign-in. The token comes from the Worker (username/password now, Google later)
 * and is sent as a Bearer token. Signing in is optional; the app works without an account.
 */
import { useSyncExternalStore } from 'react';
import type { AdminStats, AuthUser, LoginResponse, MeResponse, ProgressResponse } from '@oina/shared';
import { API_BASE } from './config';
import { storage } from './storage';

const KEY = 'session:v1';

export interface Session {
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

export class ApiCallError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function apiCall<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (session) headers.set('Authorization', `Bearer ${session.token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401 && session && !path.startsWith('/auth/login')) save(null);
  if (!res.ok) {
    const msg = ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
    throw new ApiCallError(msg, res.status);
  }
  return (await res.json()) as T;
}

export const auth = {
  get: () => session,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  async login(username: string, password: string): Promise<AuthUser> {
    const r = await apiCall<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    save({ token: r.token, expiresAt: r.expiresAt, user: r.user });
    return r.user;
  },
  async register(username: string, password: string): Promise<AuthUser> {
    const r = await apiCall<LoginResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
    save({ token: r.token, expiresAt: r.expiresAt, user: r.user });
    return r.user;
  },
  /** Forgets the token on this device. */
  clear() {
    save(null);
  },
  me: () => apiCall<MeResponse>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiCall<{ ok: true }>('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  adminStats: () => apiCall<AdminStats>('/admin/stats'),
  getProgress: () => apiCall<ProgressResponse>('/progress'),
  putProgress: (p: unknown, keepalive = false) => apiCall<ProgressResponse>('/progress', { method: 'PUT', body: JSON.stringify(p), keepalive }),
};

export function useSession(): Session | null {
  return useSyncExternalStore(auth.subscribe, auth.get, auth.get);
}

export const isAdmin = (s: Session | null) => !!s?.user.roles.includes('admin');
