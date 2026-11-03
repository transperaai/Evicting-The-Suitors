import { sql } from "./db";
import { todayIn } from "./time";
import type { Encounter, Note, Occupant, Suitor, Trigger } from "./types";

export const as = <T,>(rows: unknown) => rows as T[];

export async function allSuitors() {
  return as<Suitor>(await sql()`select * from suitors order by is_root desc, weight desc, name`);
}

export async function allOccupants() {
  return as<Occupant>(await sql()`select * from occupants order by kind desc, rhythm, name`);
}

export async function allLocations() {
  const rows = as<{ location: string }>(await sql()`
    select distinct location from (
      select location from triggers union all
      select location from notes union all
      select location from encounters
    ) l where location is not null and location <> '' order by location`);
  return rows.map((r) => r.location);
}

export async function allTriggers() {
  return as<Trigger>(await sql()`select * from triggers order by location, id`);
}

export async function allNotes() {
  return as<Note>(await sql()`
    select n.*, n.placed_on::text as placed_on, s.name as suitor_name
    from notes n left join suitors s on s.id = n.suitor_id
    order by n.status = 'removed', n.location, n.id`);
}

export async function recentEncounters(limit = 50) {
  return as<Encounter>(await sql()`
    select e.*, s.name as suitor_name, s.kind as suitor_kind
    from encounters e left join suitors s on s.id = e.suitor_id
    order by e.occurred_at desc limit ${limit}`);
}

/**
 * How much light is in the house (0..1).
 * 60% — practices actually kept over the last 7 days (the house being *occupied*).
 * 40% — suitor weight evicted (being evicted counts a little).
 */
export async function houseLight(tz: string) {
  const since = todayIn(tz, -6);
  const [r] = as<{
    practices: number; kept: number; total_weight: number; evicted_weight: number; evicting_weight: number;
  }>(await sql()`
    select
      (select count(*)::int from occupants where active and kind = 'practice') as practices,
      (select count(*)::int from day_practices dp join occupants o on o.id = dp.occupant_id
         where o.kind = 'practice' and dp.day >= ${since}::date) as kept,
      (select coalesce(sum(weight), 0)::int from suitors) as total_weight,
      (select coalesce(sum(weight), 0)::int from suitors where status = 'evicted') as evicted_weight,
      (select coalesce(sum(weight), 0)::int from suitors where status = 'evicting') as evicting_weight`);
  const occupied = r.practices ? Math.min(1, r.kept / (r.practices * 7)) : 0;
  const evicted = r.total_weight ? (r.evicted_weight + 0.25 * r.evicting_weight) / r.total_weight : 0;
  return { light: 0.6 * occupied + 0.4 * evicted, occupied, evicted, ...r };
}

export async function getIdentity() {
  const rows = as<{ key: string; value: string | null }>(
    await sql()`select key, value from settings where key in ('identity', 'identity_ref')`,
  );
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? null;
  return { text: get("identity"), reference: get("identity_ref") };
}
