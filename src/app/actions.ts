"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { AUTH_COOKIE, passphraseToken } from "@/lib/auth";
import { todayIn, userTimeZone } from "@/lib/time";
import { SUITOR_KINDS } from "@/lib/kinds";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const int = (f: FormData, k: string, d: number) => {
  const n = Number(f.get(k));
  return Number.isFinite(n) && f.get(k) !== "" && f.get(k) !== null ? n : d;
};
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const kind = (f: FormData) => {
  const k = str(f, "kind") ?? "habit";
  return k in SUITOR_KINDS ? k : "habit";
};
const done = () => revalidatePath("/", "layout");

/* ── auth ─────────────────────────────────────────── */

export async function login(form: FormData) {
  const pass = process.env.APP_PASSPHRASE;
  const given = str(form, "passphrase");
  const next = str(form, "next") ?? "/";
  if (!pass || !given || (await passphraseToken(given)) !== (await passphraseToken(pass))) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }
  (await cookies()).set(AUTH_COOKIE, await passphraseToken(pass), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", maxAge: 60 * 60 * 24 * 180,
  });
  redirect(next.startsWith("/") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}

/* ── suitors ──────────────────────────────────────── */

export async function createSuitor(form: FormData) {
  const name = str(form, "name");
  if (!name) return;
  const [row] = (await sql()`
    insert into suitors (name, kind, weight) values (${name}, ${kind(form)}, ${clamp(int(form, "weight", 3), 1, 5)})
    returning id`) as { id: number }[];
  done();
  redirect(`/suitors/${row.id}`);
}

export async function updateSuitor(id: number, form: FormData) {
  let status = str(form, "status") ?? "occupying";
  let warn = "";
  if (status !== "occupying") {
    // Matthew 12:43-45 — never leave the house empty.
    const [{ n }] = (await sql()`select count(*)::int as n from replacements where suitor_id = ${id}`) as { n: number }[];
    if (n === 0) {
      status = "occupying";
      warn = "?warn=empty";
    }
  }
  await sql()`
    update suitors set
      name = coalesce(${str(form, "name")}, name),
      kind = ${kind(form)},
      weight = ${clamp(int(form, "weight", 3), 1, 5)},
      status = ${status},
      is_root = ${form.get("is_root") === "on"},
      lie = ${str(form, "lie")},
      sounds_like = ${str(form, "sounds_like")},
      cost = ${str(form, "cost")},
      notes = ${str(form, "notes")},
      evicted_at = case when ${status} = 'evicted' then coalesce(evicted_at, now()) else null end
    where id = ${id}`;
  done();
  redirect(`/suitors/${id}${warn || "?saved=1"}`);
}

export async function deleteSuitor(id: number) {
  await sql()`delete from suitors where id = ${id}`;
  done();
  redirect("/suitors");
}

export async function addTrigger(suitorId: number, form: FormData) {
  const description = str(form, "description");
  if (!description) return;
  await sql()`insert into triggers (suitor_id, description, location, time_of_day)
              values (${suitorId}, ${description}, ${str(form, "location")}, ${str(form, "time_of_day")})`;
  done();
}

export async function deleteTrigger(id: number) {
  await sql()`delete from triggers where id = ${id}`;
  done();
}

export async function addLink(suitorId: number, form: FormData) {
  const other = int(form, "other", 0);
  const dir = str(form, "direction");
  if (!other || other === suitorId) return;
  const [from, to] = dir === "fed_by" ? [other, suitorId] : [suitorId, other];
  await sql()`insert into suitor_links (from_id, to_id) values (${from}, ${to}) on conflict do nothing`;
  done();
}

export async function deleteLink(from: number, to: number) {
  await sql()`delete from suitor_links where from_id = ${from} and to_id = ${to}`;
  done();
}

export async function assignOccupant(suitorId: number, form: FormData) {
  const occ = int(form, "occupant", 0);
  if (!occ) return;
  await sql()`insert into replacements (suitor_id, occupant_id) values (${suitorId}, ${occ}) on conflict do nothing`;
  done();
}

export async function unassignOccupant(suitorId: number, occupantId: number) {
  await sql()`delete from replacements where suitor_id = ${suitorId} and occupant_id = ${occupantId}`;
  // If the house would be left empty, it can't stay "being evicted".
  await sql()`
    update suitors set status = 'occupying', evicted_at = null
    where id = ${suitorId} and status <> 'occupying'
      and not exists (select 1 from replacements where suitor_id = ${suitorId})`;
  done();
}

/* ── household (occupants) ───────────────────────── */

async function insertOccupant(form: FormData) {
  const name = str(form, "name");
  if (!name) return null;
  const k = str(form, "kind") === "truth" ? "truth" : "practice";
  const [row] = (await sql()`
    insert into occupants (name, kind, reference, content, rhythm)
    values (${name}, ${k}, ${str(form, "reference")}, ${str(form, "content")}, ${str(form, "rhythm") ?? "daily"})
    returning id`) as { id: number }[];
  return row.id;
}

export async function createOccupant(form: FormData) {
  await insertOccupant(form);
  done();
}

export async function createOccupantFor(suitorId: number, form: FormData) {
  const id = await insertOccupant(form);
  if (id) await sql()`insert into replacements (suitor_id, occupant_id) values (${suitorId}, ${id})`;
  done();
}

export async function updateOccupant(id: number, form: FormData) {
  await sql()`
    update occupants set
      name = coalesce(${str(form, "name")}, name),
      kind = ${str(form, "kind") === "truth" ? "truth" : "practice"},
      reference = ${str(form, "reference")},
      content = ${str(form, "content")},
      rhythm = ${str(form, "rhythm") ?? "daily"},
      active = ${form.get("active") === "on"}
    where id = ${id}`;
  done();
}

export async function deleteOccupant(id: number) {
  await sql()`delete from occupants where id = ${id}`;
  await sql()`
    update suitors s set status = 'occupying', evicted_at = null
    where status <> 'occupying' and not exists (select 1 from replacements r where r.suitor_id = s.id)`;
  done();
}

/* ── rooms & notes ───────────────────────────────── */

export async function addNote(form: FormData) {
  const location = str(form, "location");
  const text = str(form, "text");
  if (!location || !text) return;
  await sql()`insert into notes (location, text, suitor_id, status)
              values (${location}, ${text}, ${int(form, "suitor", 0) || null}, ${str(form, "status") ?? "planned"})`;
  done();
}

export async function setNoteStatus(id: number, status: "planned" | "placed" | "removed") {
  const tz = await userTimeZone();
  await sql()`update notes set status = ${status},
              placed_on = case when ${status} = 'placed' then ${todayIn(tz)}::date else placed_on end
              where id = ${id}`;
  done();
}

export async function deleteNote(id: number) {
  await sql()`delete from notes where id = ${id}`;
  done();
}

/* ── encounters ──────────────────────────────────── */

export async function logEncounter(form: FormData) {
  const tz = await userTimeZone();
  const when = str(form, "occurred_at");
  const outcome = str(form, "outcome");
  await sql()`
    insert into encounters (suitor_id, location, trigger_text, intensity, outcome, note_helped, reflection, occurred_at)
    values (${int(form, "suitor", 0) || null}, ${str(form, "location")}, ${str(form, "trigger_text")},
            ${clamp(int(form, "intensity", 3), 1, 5)},
            ${outcome === "redirected" || outcome === "resisted" ? outcome : "gave_in"},
            ${str(form, "note_helped")}, ${str(form, "reflection")},
            coalesce((${when}::timestamp at time zone ${tz}), now()))`;
  done();
  redirect("/log?logged=1");
}

export async function deleteEncounter(id: number) {
  await sql()`delete from encounters where id = ${id}`;
  done();
}

/* ── daily rhythm ────────────────────────────────── */

export async function saveDay(day: string, form: FormData) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  await sql()`
    insert into days (day, slept_at, woke_at, bedtime_target, plan1, plan2, plan3, handed_over, gratitude, reflection, updated_at)
    values (${day}, ${str(form, "slept_at")}, ${str(form, "woke_at")}, ${str(form, "bedtime_target")},
            ${str(form, "plan1")}, ${str(form, "plan2")}, ${str(form, "plan3")},
            ${str(form, "handed_over")}, ${str(form, "gratitude")}, ${str(form, "reflection")}, now())
    on conflict (day) do update set
      slept_at = excluded.slept_at, woke_at = excluded.woke_at, bedtime_target = excluded.bedtime_target,
      plan1 = excluded.plan1, plan2 = excluded.plan2, plan3 = excluded.plan3,
      handed_over = excluded.handed_over, gratitude = excluded.gratitude, reflection = excluded.reflection,
      updated_at = now()`;
  const kept = form.getAll("practice").map(Number).filter(Boolean);
  await sql()`delete from day_practices where day = ${day}`;
  for (const id of new Set(kept)) {
    await sql()`insert into day_practices (day, occupant_id) values (${day}, ${id}) on conflict do nothing`;
  }
  done();
  redirect(`/rhythm?day=${day}&saved=1`);
}

/* ── in a loop ───────────────────────────────────── */

export async function handOver(form: FormData) {
  const tz = await userTimeZone();
  const day = todayIn(tz);
  const thought = str(form, "thought");
  const suitor = int(form, "suitor", 0) || null;
  if (thought) {
    const stamp = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date());
    const entry = `[${stamp}] ${thought}`;
    await sql()`
      insert into days (day, handed_over) values (${day}, ${entry})
      on conflict (day) do update set
        handed_over = case when days.handed_over is null then ${entry}
                           else days.handed_over || E'\n' || ${entry} end,
        updated_at = now()`;
  }
  await sql()`insert into encounters (suitor_id, location, outcome, intensity, trigger_text)
              values (${suitor}, ${str(form, "location")}, 'redirected', 3, ${str(form, "trigger_text")})`;
  done();
  redirect("/loop?handed=1");
}
