// Applies scripts/content.mjs to an existing database: merges the copy into the
// config, syncs the courts and replaces the rate bands. Safe to re-run.
// Usage (on the server): docker compose exec app node scripts/update-content.mjs
import pg from "pg";
import { content, COURTS, RATE_BANDS } from "./content.mjs";

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query("BEGIN");

const { rows } = await db.query("SELECT value FROM settings WHERE key='config' FOR UPDATE");
if (!rows.length) throw new Error("config not seeded");
await db.query("UPDATE settings SET value=$1, updated_at=now() WHERE key='config'", [{ ...rows[0].value, ...content }]);
console.log("config content updated");

// Courts: rename/keep the first N by sort order; extra courts are deleted when unused, otherwise marked unavailable.
const { rows: courts } = await db.query("SELECT id FROM courts ORDER BY sort, id");
for (let i = 0; i < Math.max(courts.length, COURTS.length); i++) {
  const want = COURTS[i];
  const have = courts[i];
  if (want && have) {
    await db.query("UPDATE courts SET name=$2, kind=$3, sort=$4, available=true WHERE id=$1", [have.id, want.name, want.kind, want.sort]);
  } else if (want) {
    await db.query("INSERT INTO courts(name,kind,sort) VALUES($1,$2,$3)", [want.name, want.kind, want.sort]);
  } else {
    const { rows: used } = await db.query(
      "SELECT (SELECT count(*) FROM booking_slots WHERE court_id=$1) + (SELECT count(*) FROM slot_overrides WHERE court_id=$1) + (SELECT count(*) FROM open_play_sessions WHERE court_id=$1) AS n",
      [have.id]
    );
    if (Number(used[0].n) === 0) await db.query("DELETE FROM courts WHERE id=$1", [have.id]);
    else await db.query("UPDATE courts SET available=false WHERE id=$1", [have.id]);
  }
}
console.log(`courts synced (${COURTS.length})`);

await db.query("DELETE FROM rate_bands");
for (const b of RATE_BANDS) {
  await db.query("INSERT INTO rate_bands(name,start_hour,end_hour,price,sort) VALUES($1,$2,$3,$4,$5)", [b.name, b.start_hour, b.end_hour, b.price, b.sort]);
}
console.log(`rate bands replaced (${RATE_BANDS.length})`);

await db.query("COMMIT");
await db.end();
