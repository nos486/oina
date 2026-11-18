import { describe, expect, it } from 'vitest';
import { ensureMigrated } from '../src/db/migrate.js';
import { MIGRATIONS } from '../src/db/migrations.js';
import { createTestD1 } from './d1.js';

describe('self-migration', () => {
  it('creates the schema and the default admin on an empty database', async () => {
    const db = createTestD1();
    await ensureMigrated(db);
    const admin = await db.prepare(`SELECT username, default_password FROM users WHERE id = 'u_admin'`).first();
    expect(admin).toEqual({ username: 'admin', default_password: 1 });
    const { results } = await db.prepare(`SELECT id FROM _oina_migrations`).all<{ id: string }>();
    expect(results.map((r) => r.id)).toEqual(MIGRATIONS.map((m) => m.id));
  });

  it('is safe to run again and when two instances race', async () => {
    const db = createTestD1();
    await Promise.all([ensureMigrated(db, MIGRATIONS), ensureMigrated(db, [...MIGRATIONS])]);
    await ensureMigrated(createTestD1()); // separate db untouched by the first
    expect((await db.prepare(`SELECT COUNT(*) AS n FROM users`).first<{ n: number }>())!.n).toBe(1);
  });

  it('applies only new migrations after a later deploy', async () => {
    const db = createTestD1();
    await ensureMigrated(db, MIGRATIONS);
    const next = [...MIGRATIONS, { id: '9999_test', statements: ['CREATE TABLE IF NOT EXISTS extra (x TEXT)'] }];
    await ensureMigrated(db, next); // same instance: memoized
    // A fresh instance (new deploy) sees the pending one.
    const fresh = Object.create(db) as D1Database;
    await ensureMigrated(fresh, next);
    const { results } = await db.prepare(`SELECT id FROM _oina_migrations ORDER BY id`).all<{ id: string }>();
    expect(results.map((r) => r.id)).toEqual(['0001_init', '9999_test']);
  });

  it('a failing migration leaves nothing half-applied and retries later', async () => {
    const db = createTestD1();
    const bad = [{ id: '0001_bad', statements: ['CREATE TABLE t (x TEXT)', 'NOT SQL'] }];
    await expect(ensureMigrated(db, bad)).rejects.toThrow();
    expect(await db.prepare(`SELECT name FROM sqlite_master WHERE name = 't'`).first()).toBeNull();
    await expect(ensureMigrated(db, bad)).rejects.toThrow(); // not memoized as done
  });
});
