import type { ContentBundle } from '@oina/shared';
import { API_BASE } from './config';
import { storage } from './storage';

const CACHE_KEY = 'content-cache:v1';

export class ApiError extends Error {}

async function getJson<T>(path: string): Promise<T> {
  // no-cache: always revalidate (ETag, usually a 304) so a redeploy is picked up right away.
  const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' }, cache: 'no-cache' });
  if (!res.ok) throw new ApiError(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function cachedContent(): ContentBundle | null {
  const raw = storage.get(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ContentBundle;
  } catch {
    return null;
  }
}

/** Fetches the content bundle and keeps a copy so the app starts instantly and works offline. */
export async function fetchContent(): Promise<ContentBundle> {
  const bundle = await getJson<ContentBundle>('/content');
  storage.set(CACHE_KEY, JSON.stringify(bundle));
  return bundle;
}
