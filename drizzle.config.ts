import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

const dbPath = path.resolve(process.cwd(), process.env.DB_PATH ?? "./data/evolution.sqlite");
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: dbPath,
  },
});
