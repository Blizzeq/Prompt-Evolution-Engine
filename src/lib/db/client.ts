import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "node:fs";

const DB_PATH = path.resolve(process.cwd(), process.env.DB_PATH ?? "./data/evolution.sqlite");

function createDatabase() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(DB_PATH);

  // Performance pragmas for SQLite
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("busy_timeout = 30000");
  sqlite.pragma("foreign_keys = ON");

  recoverOrphanedRuns(sqlite);

  return drizzle(sqlite, { schema });
}

function recoverOrphanedRuns(sqlite: Database.Database): void {
  sqlite.exec(`
    UPDATE evolution_runs
    SET
      status = 'failed',
      error = CASE
        WHEN error IS NULL OR error = '' THEN 'Run was interrupted by a process restart.'
        ELSE error
      END,
      completed_at = COALESCE(completed_at, datetime('now'))
    WHERE status IN ('pending', 'initializing', 'running');
  `);
}

// Singleton — reuse across hot reloads in dev, lazy init for build
const globalForDb = globalThis as unknown as { db: ReturnType<typeof createDatabase> | undefined };

function getDb() {
  if (!globalForDb.db) {
    globalForDb.db = createDatabase();
  }
  return globalForDb.db;
}

// Lazy proxy that defers DB creation until first access
export const db = new Proxy({} as ReturnType<typeof createDatabase>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type DatabaseClient = ReturnType<typeof createDatabase>;
