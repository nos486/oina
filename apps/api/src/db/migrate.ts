/**
 * Self-migration: the first request that needs the database in each Worker instance applies any
 * pending migrations, then remembers that it did. A deploy with a new migration therefore updates
 * the database on its own; nothing has to be run by hand.
 */
import { MIGRATIONS, type Migration } from './migrations.js';

const TABLE = '_oina_migrations';
const done = new WeakMap<D1Database, Promise<void>>();

async function apply(db: D1Database, migrations: Migration[]): Promise<void> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${TABLE} (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`).run();
  const { results } = await db.prepare(`SELECT id FROM ${TABLE}`).all<{ id: string }>();
  const applied = new Set(results.map((r) => r.id));
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    // One batch = one transaction: the migration and its record land together or not at all.
    await db.batch([
      ...m.statements.map((sql) => db.prepare(sql)),
      db.prepare(`INSERT OR IGNORE INTO ${TABLE} (id, applied_at) VALUES (?, ?)`).bind(m.id, new Date().toISOString()),
    ]);
  }
}

/** Resolves once the schema is current. Cheap after the first call in an instance. */
export function ensureMigrated(db: D1Database, migrations: Migration[] = MIGRATIONS): Promise<void> {
  let p = done.get(db);
  if (!p) {
    p = apply(db, migrations).catch((err) => {
      done.delete(db); // try again on the next request
      throw err;
    });
    done.set(db, p);
  }
  return p;
}
