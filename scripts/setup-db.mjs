// Creates the schema and (with --seed) fills the house with your starting suitors and household.
// Usage: DATABASE_URL=... node scripts/setup-db.mjs [--seed] [--force]
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { seed } from "./seed-data.mjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}
const sql = neon(url);

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

for (const stmt of schema.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) {
  await sql.query(stmt);
}
console.log("✓ schema ready");

if (process.argv.includes("--seed")) {
  const [{ count }] = await sql`select count(*)::int as count from suitors`;
  if (count > 0 && !process.argv.includes("--force")) {
    console.log(`House already has ${count} suitors — skipping seed (pass --force to seed anyway).`);
    process.exit(0);
  }

  const suitorIds = {};
  for (const s of seed.suitors) {
    const [row] = await sql`
      insert into suitors (name, kind, weight, status, is_root, lie, sounds_like, cost)
      values (${s.name}, ${s.kind}, ${s.weight}, ${s.status ?? "occupying"}, ${!!s.root},
              ${s.lie ?? null}, ${s.soundsLike ?? null}, ${s.cost ?? null})
      returning id`;
    suitorIds[s.key] = row.id;
    for (const t of s.triggers ?? []) {
      await sql`insert into triggers (suitor_id, description, location, time_of_day)
                values (${row.id}, ${t[0]}, ${t[1]}, ${t[2]})`;
    }
  }
  for (const [from, to] of seed.links) {
    await sql`insert into suitor_links (from_id, to_id) values (${suitorIds[from]}, ${suitorIds[to]})
              on conflict do nothing`;
  }

  const occIds = {};
  for (const o of seed.occupants) {
    const [row] = await sql`
      insert into occupants (name, kind, reference, content, rhythm)
      values (${o.name}, ${o.kind}, ${o.reference ?? null}, ${o.content ?? null}, ${o.rhythm ?? "daily"})
      returning id`;
    occIds[o.key] = row.id;
  }
  for (const [suitor, occs] of Object.entries(seed.replacements)) {
    for (const o of occs) {
      await sql`insert into replacements (suitor_id, occupant_id) values (${suitorIds[suitor]}, ${occIds[o]})
                on conflict do nothing`;
    }
  }
  for (const n of seed.notes) {
    await sql`insert into notes (location, text, suitor_id, status)
              values (${n.location}, ${n.text}, ${suitorIds[n.suitor] ?? null}, 'planned')`;
  }
  console.log(`✓ seeded ${seed.suitors.length} suitors, ${seed.occupants.length} occupants, ${seed.notes.length} notes`);
}
