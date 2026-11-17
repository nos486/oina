/**
 * A small in-memory D1 for tests, backed by node:sqlite and seeded with the real migrations,
 * so the SQL in src/db/repo.ts runs against the same schema as production.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

type Value = string | number | null;

class Stmt {
  private args: Value[] = [];
  constructor(private db: DatabaseSync, private sql: string) {}
  bind(...args: Value[]) {
    this.args = args;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return ((this.db.prepare(this.sql).get(...this.args) as T | undefined) ?? null);
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.prepare(this.sql).all(...this.args) as T[] };
  }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(r.changes) } };
  }
}

export function createTestD1(): D1Database {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of fs.readdirSync(migrations).filter((x) => x.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(migrations, f), 'utf8'));
  }
  return { prepare: (sql: string) => new Stmt(db, sql) } as unknown as D1Database;
}
