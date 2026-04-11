import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "evolution.sqlite");

function createDatabase() {
  const fs = require("fs");
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(DB_PATH);

  // Performance pragmas for SQLite
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("busy_timeout = 10000");
  sqlite.pragma("foreign_keys = ON");

  return drizzle(sqlite, { schema });
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
