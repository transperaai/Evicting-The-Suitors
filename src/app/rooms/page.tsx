import Link from "next/link";
import { addNote, deleteNote, setNoteStatus } from "@/app/actions";
import { sql } from "@/lib/db";
import { allLocations, allNotes, as } from "@/lib/queries";
import { kindColor } from "@/lib/kinds";
import type { Suitor } from "@/lib/types";
import { userTimeZone } from "@/lib/time";

type TriggerRow = { id: number; description: string; location: string | null; time_of_day: string | null; suitor_id: number; name: string; kind: string };
type EncRow = { location: string; n: number; gave_in: number; hours: number[] };

const key = (s: string) => s.trim().toLowerCase();

function hourLabel(h: number) {
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "late night";
}

export default async function RoomsPage() {
  const db = sql();
  const tz = await userTimeZone();
  const [triggers, notes, enc, suitors, locations] = await Promise.all([
    db`select t.*, s.name, s.kind from triggers t join suitors s on s.id = t.suitor_id
       where s.status <> 'evicted' and t.location is not null order by t.location`.then(as<TriggerRow>),
    allNotes(),
    db`select location, count(*)::int as n,
          count(*) filter (where outcome = 'gave_in')::int as gave_in,
          array_agg(extract(hour from occurred_at at time zone ${tz})::int) as hours
       from encounters where location is not null and occurred_at > now() - interval '60 days'
       group by location`.then(as<EncRow>),
    db`select id, name from suitors where status <> 'evicted' order by name`.then(as<Pick<Suitor, "id" | "name">>),
    allLocations(),
  ]);

  // Group everything by room
  const rooms = new Map<string, { name: string; triggers: TriggerRow[]; notes: typeof notes; enc?: EncRow }>();
  const room = (name: string) => {
    const k = key(name);
    if (!rooms.has(k)) rooms.set(k, { name, triggers: [], notes: [] });
    return rooms.get(k)!;
  };
  triggers.forEach((t) => t.location && room(t.location).triggers.push(t));
  notes.forEach((n) => room(n.location).notes.push(n));
  enc.forEach((e) => { room(e.location).enc = e; });

  const list = [...rooms.values()].map((r) => {
    const guardedSuitors = new Set(r.notes.filter((n) => n.status === "placed").map((n) => n.suitor_id));
    const strikers = new Map<number, TriggerRow>();
    r.triggers.forEach((t) => strikers.set(t.suitor_id, t));
    const unguarded = [...strikers.values()].filter((t) => !guardedSuitors.has(t.suitor_id));
    return { ...r, strikers: [...strikers.values()], unguarded };
  }).sort((a, b) => b.unguarded.length - a.unguarded.length || b.strikers.length - a.strikers.length);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>The Rooms</h1>
          <p>Where suitors get in. Each room shows who comes through that door and the handwritten notes you&rsquo;ve left there. An <strong>unguarded door</strong> is a room where a suitor gets in and you have no note placed yet. Write one, put it there, and mark it placed.</p>
        </div>
      </div>

      <form action={addNote} className="card" style={{ marginBottom: 28 }}>
        <h3>Write a note for a room</h3>
        <div className="fields">
          <div><label>Room / place</label><input name="location" list="locations" required placeholder="e.g. Bedside" /></div>
          <div><label>Guards against</label>
            <select name="suitor" defaultValue=""><option value="">—</option>{suitors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </div>
          <div><label>Status</label>
            <select name="status" defaultValue="planned"><option value="planned">Planned (still to write)</option><option value="placed">Placed</option></select>
          </div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>What the note says</label><textarea name="text" required className="handwritten" placeholder="Write it exactly as you'll hand-write it." /></div>
        <button className="primary">Add note</button>
        <datalist id="locations">{locations.map((l) => <option key={l} value={l} />)}</datalist>
      </form>

      {list.length === 0 && <p className="muted">No rooms yet. Add a location to a trigger, a note, or a logged encounter.</p>}

      <div className="grid-2">
        {list.map((r) => (
          <div key={r.name} className={`card ${r.unguarded.length ? "warn" : ""}`}>
            <div className="spread">
              <h2 style={{ margin: 0 }}>📍 {r.name}</h2>
              {r.unguarded.length > 0
                ? <span className="pill ember">{r.unguarded.length} unguarded</span>
                : r.strikers.length > 0 && <span className="pill ok">guarded</span>}
            </div>
            {r.enc && (
              <p className="muted" style={{ marginTop: 6 }}>
                {r.enc.n} encounters in 60 days ({r.enc.gave_in} gave in) · mostly {(() => {
                  const counts: Record<string, number> = {};
                  r.enc!.hours.forEach((h) => { const l = hourLabel(h); counts[l] = (counts[l] ?? 0) + 1; });
                  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
                })()}
              </p>
            )}

            {r.strikers.length > 0 && (
              <>
                <small>Who gets in here</small>
                <ul className="list" style={{ marginBottom: 12 }}>
                  {r.triggers.map((t) => (
                    <li key={t.id}>
                      <span className="row" style={{ gap: 8 }}>
                        <i className="dot" style={{ background: kindColor(t.kind) }} />
                        <Link href={`/suitors/${t.suitor_id}`}>{t.name}</Link>
                        {r.unguarded.some((u) => u.suitor_id === t.suitor_id) && <span className="pill ember">no note placed</span>}
                      </span>
                      <small className="muted">{t.description}{t.time_of_day ? ` · ${t.time_of_day}` : ""}</small>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {r.notes.length > 0 && <small>Notes</small>}
            <div className="grid" style={{ marginTop: 6 }}>
              {r.notes.map((n) => (
                <div key={n.id} className={`note-card ${n.status}`}>
                  <div className="handwritten">{n.text}</div>
                  <div className="spread" style={{ marginTop: 8 }}>
                    <small style={{ opacity: 0.7 }}>{n.suitor_name ? `vs. ${n.suitor_name} · ` : ""}{n.status === "placed" ? `placed ${n.placed_on}` : n.status}</small>
                    <span className="row" style={{ gap: 4 }}>
                      {n.status !== "placed" && <form action={setNoteStatus.bind(null, n.id, "placed")}><button className="ghost" style={{ color: "inherit" }}>Mark placed</button></form>}
                      {n.status === "placed" && <form action={setNoteStatus.bind(null, n.id, "removed")}><button className="ghost" style={{ color: "inherit" }}>Taken down</button></form>}
                      <form action={deleteNote.bind(null, n.id)}><button className="ghost" style={{ color: "inherit" }} title="Delete">✕</button></form>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
