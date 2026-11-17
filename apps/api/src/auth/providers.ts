/**
 * Sign-in providers. Each one turns a credential into a user row; the session token is the same
 * for all of them. Google later = verify the Google ID token (https://www.googleapis.com/oauth2/v3/certs,
 * audience GOOGLE_CLIENT_ID), then Repo.userByIdentity('google', sub) or create + linkIdentity.
 */
import type { Repo, UserRow } from '../db/repo.js';
import { verifyPassword } from './password.js';

export interface AuthEnv {
  /** D1 database with users, identities, progress, config (see migrations/). */
  DB?: D1Database;
  /** Optional override for the session signing key; otherwise one is generated and kept in D1. */
  AUTH_SECRET?: string;
  /** Future: Google OAuth client id. */
  GOOGLE_CLIENT_ID?: string;
}

export async function passwordLogin(repo: Repo, username: string, password: string): Promise<UserRow | null> {
  const row = await repo.userByUsername(username.trim().toLowerCase());
  // verifyPassword does the same work for unknown users, so timing does not reveal which usernames exist.
  const ok = await verifyPassword(password, row?.password_hash);
  return ok && row ? row : null;
}
