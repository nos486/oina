/**
 * A small in-memory D1 for tests, backed by node:sqlite. Starts empty: the Worker's own
 * self-migration creates the schema, exactly as in production.
 */
import { DatabaseSync } from 'node:sqlite';

type Value = string | number | null;

class Stmt {
  args: Value[] = [];
  constructor(private db: DatabaseSync, readonly sql: string) {}
  bind(...args: Value[]) {
    this.args = args;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return (this.db.prepare(this.sql).get(...this.args) as T | undefined) ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.prepare(this.sql).all(...this.args) as T[] };
  }
  async run() {
    return this.runSync();
  }
  runSync() {
    const r = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(r.changes) } };
  }
}

export function createTestD1(): D1Database {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  return {
    prepare: (sql: string) => new Stmt(db, sql),
    // Like D1: all statements in one transaction.
    batch: async (stmts: Stmt[]) => {
      db.exec('BEGIN');
      try {
        const out = stmts.map((s) => s.runSync());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  } as unknown as D1Database;
}
