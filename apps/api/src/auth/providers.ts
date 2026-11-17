/**
 * Sign-in providers. Each one turns a credential into an AuthUser; the session token is the same
 * for all of them. Adding Google later = a new provider that verifies a Google ID token
 * (https://www.googleapis.com/oauth2/v3/certs) and maps the email to an AuthUser.
 */
import type { AuthUser } from '@oina/shared';
import { safeEqual } from './token.js';

export interface AuthEnv {
  /** Test login. Defaults: admin / admin. Set real values with `wrangler secret put`. */
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  /** Signs session tokens. Set with `wrangler secret put AUTH_SECRET`. */
  AUTH_SECRET?: string;
  /** Future: Google OAuth client id for verifying ID tokens. */
  GOOGLE_CLIENT_ID?: string;
}

export const DEFAULT_ADMIN = { username: 'admin', password: 'admin' };

export function adminCredentials(env: AuthEnv) {
  return {
    username: env.ADMIN_USERNAME || DEFAULT_ADMIN.username,
    password: env.ADMIN_PASSWORD || DEFAULT_ADMIN.password,
  };
}

/** True while the default admin/admin password is in use (shown as a warning to admins). */
export const usingDefaultPassword = (env: AuthEnv) => !env.ADMIN_PASSWORD;

/**
 * Signing secret. Without AUTH_SECRET it falls back to one derived from the admin password,
 * which is fine for testing but means anyone who knows that password could mint tokens.
 */
export function signingSecret(env: AuthEnv): string {
  return env.AUTH_SECRET || `oina-dev:${adminCredentials(env).username}:${adminCredentials(env).password}`;
}

export async function passwordLogin(env: AuthEnv, username: string, password: string): Promise<AuthUser | null> {
  const admin = adminCredentials(env);
  // Always run both comparisons so timing does not reveal which part was wrong.
  const [u, p] = await Promise.all([safeEqual(username.trim().toLowerCase(), admin.username.toLowerCase()), safeEqual(password, admin.password)]);
  if (!u || !p) return null;
  return { id: `password:${admin.username}`, name: admin.username, roles: ['admin'], provider: 'password' };
}
