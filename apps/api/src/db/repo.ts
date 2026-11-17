/** All D1 access lives here, so routes stay small and the store can change later. */
import type { AuthUser, Progress, Role } from '@oina/shared';

export interface UserRow {
  id: string;
  username: string | null;
  email: string | null;
  name: string;
  password_hash: string | null;
  roles: string;
  default_password: number;
  created_at: string;
}

export function toAuthUser(row: UserRow, provider: AuthUser['provider'] = 'password'): AuthUser {
  let roles: Role[] = ['user'];
  try {
    roles = JSON.parse(row.roles) as Role[];
  } catch {
    /* keep default */
  }
  return { id: row.id, name: row.name, roles, provider };
}

const newId = () => `u_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

export interface UserSummary {
  id: string;
  username: string | null;
  name: string;
  roles: string;
  created_at: string;
  xp: number | null;
  lessons: number | null;
  progress_at: string | null;
}

export class Repo {
  constructor(private db: D1Database) {}

  // ---------- config ----------

  /** The session signing key; created once in D1 and shared by every Worker instance. */
  async authSecret(): Promise<string> {
    const read = () => this.db.prepare(`SELECT value FROM config WHERE key = 'auth_secret'`).first<{ value: string }>();
    const row = await read();
    if (row) return row.value;
    const secret = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    await this.db.prepare(`INSERT OR IGNORE INTO config (key, value) VALUES ('auth_secret', ?)`).bind(secret).run();
    // Another instance may have won the race; use whatever is stored.
    return (await read())!.value;
  }

  // ---------- users ----------

  userById(id: string) {
    return this.db.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first<UserRow>();
  }

  userByUsername(username: string) {
    return this.db.prepare(`SELECT * FROM users WHERE username = ?`).bind(username).first<UserRow>();
  }

  async createUser(u: { username?: string; email?: string; name: string; passwordHash?: string; roles?: Role[] }): Promise<UserRow> {
    const id = newId();
    await this.db
      .prepare(`INSERT INTO users (id, username, email, name, password_hash, roles) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, u.username ?? null, u.email ?? null, u.name, u.passwordHash ?? null, JSON.stringify(u.roles ?? ['user']))
      .run();
    return (await this.userById(id))!;
  }

  async setPassword(id: string, passwordHash: string): Promise<void> {
    await this.db
      .prepare(`UPDATE users SET password_hash = ?, default_password = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
      .bind(passwordHash, id)
      .run();
  }

  /** For Google sign-in later: the user linked to an external account. */
  userByIdentity(provider: string, subject: string) {
    return this.db
      .prepare(`SELECT u.* FROM users u JOIN identities i ON i.user_id = u.id WHERE i.provider = ? AND i.subject = ?`)
      .bind(provider, subject)
      .first<UserRow>();
  }

  async linkIdentity(userId: string, provider: string, subject: string): Promise<void> {
    await this.db.prepare(`INSERT OR IGNORE INTO identities (provider, subject, user_id) VALUES (?, ?, ?)`).bind(provider, subject, userId).run();
  }

  async countUsers(): Promise<number> {
    return (await this.db.prepare(`SELECT COUNT(*) AS n FROM users`).first<{ n: number }>())?.n ?? 0;
  }

  async recentUsers(limit = 50): Promise<UserSummary[]> {
    const { results } = await this.db
      .prepare(
        `SELECT u.id, u.username, u.name, u.roles, u.created_at, p.xp, p.lessons, p.updated_at AS progress_at
         FROM users u LEFT JOIN progress p ON p.user_id = u.id
         ORDER BY COALESCE(p.updated_at, u.created_at) DESC LIMIT ?`,
      )
      .bind(limit)
      .all<UserSummary>();
    return results;
  }

  // ---------- progress ----------

  async getProgress(userId: string): Promise<{ data: unknown; updatedAt: string } | null> {
    const row = await this.db.prepare(`SELECT data, updated_at FROM progress WHERE user_id = ?`).bind(userId).first<{ data: string; updated_at: string }>();
    if (!row) return null;
    try {
      return { data: JSON.parse(row.data), updatedAt: row.updated_at };
    } catch {
      return null;
    }
  }

  async putProgress(userId: string, p: Progress): Promise<string> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO progress (user_id, data, xp, lessons, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, xp = excluded.xp, lessons = excluded.lessons, updated_at = excluded.updated_at`,
      )
      .bind(userId, JSON.stringify(p), p.xp, p.completedLessons.length, now)
      .run();
    return now;
  }
}
