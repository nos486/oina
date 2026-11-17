-- Oina accounts and saved progress.
-- Apply with: npx wrangler d1 migrations apply oina --remote

CREATE TABLE users (
  id               TEXT PRIMARY KEY,                -- random id, e.g. "u_3f9c..."
  username         TEXT UNIQUE COLLATE NOCASE,       -- password login; NULL for Google-only users
  email            TEXT UNIQUE COLLATE NOCASE,       -- filled by Google sign-in later
  name             TEXT NOT NULL,
  password_hash    TEXT,                             -- pbkdf2 (iterations, salt, hash); NULL for Google-only users
  roles            TEXT NOT NULL DEFAULT '["user"]', -- JSON array: "admin", "user"
  default_password INTEGER NOT NULL DEFAULT 0,       -- 1 while the seeded password is unchanged
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- External sign-in accounts (Google later): provider + the provider's user id -> our user.
CREATE TABLE identities (
  provider   TEXT NOT NULL,   -- "google"
  subject    TEXT NOT NULL,   -- Google "sub"
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (provider, subject)
);
CREATE INDEX identities_user ON identities(user_id);

-- One row per user: the client's Progress object (JSON), merged on every save.
CREATE TABLE progress (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       TEXT NOT NULL,
  xp         INTEGER NOT NULL DEFAULT 0,   -- copied out of data for admin views
  lessons    INTEGER NOT NULL DEFAULT 0,   -- completed lesson count
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Server settings. "auth_secret" (session signing key) is generated on first use.
CREATE TABLE config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default admin: username "admin", password "admin". Change it in the app (Tools -> change password).
INSERT INTO users (id, username, name, password_hash, roles, default_password)
VALUES ('u_admin', 'admin', 'admin', 'pbkdf2$100000$X5JeWXpRFJ8/bFkb1m5Ptg==$e2Kfc+CsOcoba9Pz4s7CksZWomBXgNVSIj4eLf/E6FM=', '["admin","user"]', 1);
