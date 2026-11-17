/** Runtime configuration from Vite env vars (see apps/web/.env.example). */
const trimSlash = (s: string) => s.replace(/\/+$/, '');

export const API_BASE = trimSlash(import.meta.env.VITE_API_BASE ?? '/api/v1');
export const AUDIO_BASE = trimSlash(import.meta.env.VITE_AUDIO_BASE ?? '/audio') + '/';
