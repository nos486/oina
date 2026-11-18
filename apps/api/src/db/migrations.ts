/**
 * Database migrations, applied automatically by the Worker itself (see migrate.ts):
 * no `wrangler d1 migrations apply` step is needed on deploy.
 *
 * Rules for adding one:
 * - Append a new entry with the next id; never edit or reorder an applied one.
 * - Keep every statement safe to run twice (IF NOT EXISTS, INSERT OR IGNORE), because two
 *   Worker instances may start the same migration at the same moment.
 * - One SQL statement per string.
 */
export interface Migration {
  id: string;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    id: '0001_init',
    statements: [
      // Accounts. username: password login (NULL for Google-only users); email: filled by Google later.
      // password_hash: pbkdf2$<iterations>$<salt b64>$<hash b64>. roles: JSON array ("admin", "user").
      // default_password: 1 while the seeded admin password is unchanged.
      `CREATE TABLE IF NOT EXISTS users (
        id               TEXT PRIMARY KEY,
        username         TEXT UNIQUE COLLATE NOCASE,
        email            TEXT UNIQUE COLLATE NOCASE,
        name             TEXT NOT NULL,
        password_hash    TEXT,
        roles            TEXT NOT NULL DEFAULT '["user"]',
        default_password INTEGER NOT NULL DEFAULT 0,
        created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
      // External sign-in accounts (Google later): provider + provider's user id → our user.
      `CREATE TABLE IF NOT EXISTS identities (
        provider   TEXT NOT NULL,
        subject    TEXT NOT NULL,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (provider, subject)
      )`,
      `CREATE INDEX IF NOT EXISTS identities_user ON identities(user_id)`,
      // One row per user: the client's Progress object (JSON), merged on every save.
      `CREATE TABLE IF NOT EXISTS progress (
        user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data       TEXT NOT NULL,
        xp         INTEGER NOT NULL DEFAULT 0,
        lessons    INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
      // Server settings; "auth_secret" (session signing key) is generated on first use.
      `CREATE TABLE IF NOT EXISTS config (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
      // Default admin: username "admin", password "admin". Change it in the app (Tools → change password).
      `INSERT OR IGNORE INTO users (id, username, name, password_hash, roles, default_password)
       VALUES ('u_admin', 'admin', 'admin', 'pbkdf2$100000$X5JeWXpRFJ8/bFkb1m5Ptg==$e2Kfc+CsOcoba9Pz4s7CksZWomBXgNVSIj4eLf/E6FM=', '["admin","user"]', 1)`,
    ],
  },
];
