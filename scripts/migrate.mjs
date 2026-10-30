// Applies db/migrations/*.sql in order, once each. Usage: node scripts/migrate.mjs
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
const dir = path.resolve("db/migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  const { rows } = await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [f]);
  if (rows.length) continue;
  const sql = await readFile(path.join(dir, f), "utf8");
  console.log("applying", f);
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [f]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
}
await client.end();
console.log("migrations up to date");
