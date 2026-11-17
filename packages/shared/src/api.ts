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

export interface RegisterRequest {
  username: string;
  password: string;
  name?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface MeResponse {
  user: AuthUser;
  /** True while the seeded admin/admin password is unchanged. */
  defaultPassword: boolean;
}

/** GET/PUT /api/v1/progress. `progress` is the Progress object (null if nothing saved yet). */
export interface ProgressResponse {
  progress: unknown | null;
  updatedAt: string | null;
}

export interface AdminUserRow {
  id: string;
  username: string | null;
  name: string;
  roles: Role[];
  createdAt: string;
  xp: number;
  lessons: number;
  lastProgressAt: string | null;
}

export interface AdminStats {
  contentVersion: string;
  letters: number;
  words: number;
  lessons: number;
  audioFiles: number;
  needsReview: { id: string; cyrillic: string; persian: string }[];
  /** null when the D1 database is not connected. */
  users: number | null;
  recentUsers: AdminUserRow[];
}

export const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;
export const MIN_PASSWORD_LENGTH = 6;
