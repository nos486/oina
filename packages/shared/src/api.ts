/** Shared API contract between apps/api and apps/web. */
export const API_VERSION = 'v1';

export interface ApiError {
  error: string;
}

export interface StageSummary {
  id: number;
  titleFa: string;
  descriptionFa: string;
  track: 'tg' | 'ru';
  lessons: { id: string; titleFa: string; newLetters: string[] }[];
  comingSoon?: boolean;
}

// ---------- auth ----------

export type Role = 'admin' | 'user';

/** How the user signed in. "password" is the test login; "google" comes later. */
export type AuthProvider = 'password' | 'google';

export interface AuthUser {
  id: string;
  name: string;
  roles: Role[];
  provider: AuthProvider;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  /** ISO date-time. */
  expiresAt: string;
  user: AuthUser;
}

export interface AdminStats {
  contentVersion: string;
  letters: number;
  words: number;
  lessons: number;
  audioFiles: number;
  needsReview: { id: string; cyrillic: string; persian: string }[];
}
