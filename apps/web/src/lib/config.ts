/** Runtime configuration from Vite env vars (see apps/web/.env.example). */
const trimSlash = (s: string) => s.replace(/\/+$/, '');

/**
 * VITE_API_BASE may be the Worker origin ("https://oina-api.example.org") or the full
 * versioned base ("https://oina-api.example.org/api/v1"); both work.
 */
export function resolveApiBase(raw: string | undefined): string {
  const base = trimSlash(raw?.trim() || '/api/v1');
  return /\/api\/v\d+$/.test(base) ? base : `${base}/api/v1`;
}

export const API_BASE = resolveApiBase(import.meta.env.VITE_API_BASE);
export const AUDIO_BASE = trimSlash(import.meta.env.VITE_AUDIO_BASE ?? '/audio') + '/';
