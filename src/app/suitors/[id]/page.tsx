import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addLink, addTrigger, assignOccupant, createOccupantFor, deleteLink, deleteSuitor, deleteTrigger,
  unassignOccupant, updateSuitor,
} from "@/app/actions";
import { sql } from "@/lib/db";
import { allLocations, as } from "@/lib/queries";
import { OUTCOMES, RHYTHMS, STATUSES, SUITOR_KINDS, kindColor } from "@/lib/kinds";
import { formatWhen, userTimeZone } from "@/lib/time";
import type { Encounter, Note, Occupant, Suitor, Trigger } from "@/lib/types";

export default async function SuitorPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ warn?: string; saved?: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const { warn, saved } = await searchParams;
  const tz = await userTimeZone();
  const db = sql();

  const [s] = as<Suitor>(await db`select * from suitors where id = ${id}`);
  if (!s) notFound();

  const [triggers, feeds, fedBy, occupants, allOcc, others, notes, encounters, locations] = await Promise.all([
    db`select * from triggers where suitor_id = ${id} order by id`.then(as<Trigger>),
    db`select s.id, s.name, s.kind from suitor_links l join suitors s on s.id = l.to_id where l.from_id = ${id} order by s.name`
      .then(as<Pick<Suitor, "id" | "name" | "kind">>),
    db`select s.id, s.name, s.kind from suitor_links l join suitors s on s.id = l.from_id where l.to_id = ${id} order by s.name`
      .then(as<Pick<Suitor, "id" | "name" | "kind">>),
    db`select o.* from replacements r join occupants o on o.id = r.occupant_id where r.suitor_id = ${id} order by o.kind desc, o.name`
      .then(as<Occupant>),
    db`select * from occupants where id not in (select occupant_id from replacements where suitor_id = ${id}) order by kind desc, name`
      .then(as<Occupant>),
    db`select id, name from suitors where id <> ${id} order by name`.then(as<Pick<Suitor, "id" | "name">>),
    db`select *, placed_on::text as placed_on from notes where suitor_id = ${id} and status <> 'removed' order by id`.then(as<Note>),
    db`select * from encounters where suitor_id = ${id} order by occurred_at desc limit 8`.then(as<Encounter>),
    allLocations(),
  ]);

  const empty = occupants.length === 0;

  return (
    <>
      <p><Link href="/suitors" className="muted">← All suitors</Link></p>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <i className="dot" style={{ background: kindColor(s.kind), width: 12, height: 12 }} />
            <span className={`pill ${s.status === "evicting" ? "gold" : s.status === "evicted" ? "ok" : ""}`}>{STATUSES[s.status]}</span>
            {s.is_root && <span className="pill ember">first domino</span>}
          </div>
          <h1>{s.name}</h1>
          {s.lie && <p className="serif" style={{ fontStyle: "italic", fontSize: "1.1rem" }}>The lie: &ldquo;{s.lie}&rdquo;</p>}
        </div>
      </div>

      {warn === "empty" && (
        <div className="flash warn">
          You can&rsquo;t evict into an empty house. <em>&ldquo;When it returns and finds the house swept clean and put in order, it brings seven others.&rdquo;</em> Give this room to at least one truth or practice below, then set it to being evicted.
        </div>
      )}
      {saved && <div className="flash ok">Saved.</div>}

      <div className="grid-2">
        {/* The card */}
        <form action={updateSuitor.bind(null, id)} className="card">
          <h3>The suitor</h3>
          <div className="field"><label>Name</label><input name="name" defaultValue={s.name} required /></div>
          <div className="fields">
            <div>
              <label>Kind</label>
              <select name="kind" defaultValue={s.kind}>
                {Object.entries(SUITOR_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label>Room it takes (1–5)</label>
              <input name="weight" type="number" min={1} max={5} defaultValue={s.weight} />
            </div>
            <div>
              <label>Status</label>
              <select name="status" defaultValue={s.status}>
                {Object.entries(STATUSES).map(([k, v]) => (
                  <option key={k} value={k} disabled={empty && k !== "occupying"}>{v}{empty && k !== "occupying" ? " (needs an occupant)" : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="check" style={{ marginTop: 8 }}>
            <input type="checkbox" name="is_root" defaultChecked={s.is_root} />
            <span>This is a first domino. It starts the chain.</span>
          </label>
          <div className="field"><label>The lie underneath it (the limiting belief)</label>
            <textarea name="lie" defaultValue={s.lie ?? ""} placeholder="What does it make you believe about yourself, God, or the future?" /></div>
          <div className="field"><label>What it sounds like in my head</label>
            <textarea name="sounds_like" defaultValue={s.sounds_like ?? ""} /></div>
          <div className="field"><label>What it costs me</label>
            <textarea name="cost" defaultValue={s.cost ?? ""} /></div>
          <div className="field"><label>Notes</label>
            <textarea name="notes" defaultValue={s.notes ?? ""} /></div>
          <button className="primary">Save</button>
        </form>

        <div className="grid" style={{ alignContent: "start" }}>
          {/* Occupants */}
          <div className={`card ${empty ? "warn" : "gold"}`}>
            <h3>Who occupies its room</h3>
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              {empty
                ? "Nothing yet. If you evict this, the room is left empty. Choose what you'll fill it with first."
                : "The truths and practices that take this suitor's place."}
            </p>
            <ul className="list">
              {occupants.map((o) => (
                <li key={o.id} className="spread">
                  <div>
                    <Link href={`/household#o${o.id}`}>{o.name}</Link>
                    {o.reference && <small className="muted"> · {o.reference}</small>}
                    <div><small className="faint">{o.kind === "truth" ? "Truth" : "Practice"} · {RHYTHMS[o.rhythm as keyof typeof RHYTHMS] ?? o.rhythm}</small></div>
                  </div>
                  <form action={unassignOccupant.bind(null, id, o.id)}><button className="ghost" title="Remove">✕</button></form>
                </li>
              ))}
            </ul>
            {allOcc.length > 0 && (
              <form action={assignOccupant.bind(null, id)} className="row" style={{ marginTop: 10 }}>
                <select name="occupant" style={{ flex: 1, minWidth: 0 }} required defaultValue="">
                  <option value="" disabled>Choose from the household…</option>
                  {allOcc.map((o) => <option key={o.id} value={o.id}>{o.kind === "truth" ? "✝ " : "◆ "}{o.name}{o.reference ? ` (${o.reference})` : ""}</option>)}
                </select>
                <button>Add</button>
              </form>
            )}
            <details style={{ marginTop: 10 }}>
              <summary className="muted" style={{ cursor: "pointer" }}>Or write a new one</summary>
              <form action={createOccupantFor.bind(null, id)} style={{ marginTop: 10 }}>
                <div className="fields">
                  <div><label>Kind</label><select name="kind" defaultValue="truth"><option value="truth">Truth (scripture)</option><option value="practice">Practice</option></select></div>
                  <div><label>Reference</label><input name="reference" placeholder="e.g. Psalm 4:8" /></div>
                  <div><label>When</label><select name="rhythm" defaultValue="daily">{Object.entries(RHYTHMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                </div>
                <div className="field" style={{ marginTop: 10 }}><label>Name</label><input name="name" required /></div>
                <div className="field"><label>The verse, or how you&rsquo;ll do it</label><textarea name="content" /></div>
                <button>Add to the household</button>
              </form>
            </details>
          </div>

          {/* Triggers */}
          <div className="card">
            <h3>How it gets in</h3>
            <ul className="list">
              {triggers.map((t) => (
                <li key={t.id} className="spread">
                  <div>
                    {t.description}
                    <div><small className="muted">{[t.location && `📍 ${t.location}`, t.time_of_day].filter(Boolean).join(" · ")}</small></div>
                  </div>
                  <form action={deleteTrigger.bind(null, t.id)}><button className="ghost" title="Remove">✕</button></form>
                </li>
              ))}
              {triggers.length === 0 && <li className="muted">No triggers named yet.</li>}
            </ul>
            <form action={addTrigger.bind(null, id)} style={{ marginTop: 10 }}>
              <div className="field"><input name="description" placeholder="The trigger: what happens right before?" required /></div>
              <div className="fields">
                <div><input name="location" placeholder="Room / place" list="locations" /></div>
                <div><input name="time_of_day" placeholder="When (e.g. Late night)" /></div>
              </div>
              <button style={{ marginTop: 10 }}>Add trigger</button>
              <datalist id="locations">{locations.map((l) => <option key={l} value={l} />)}</datalist>
            </form>
          </div>

          {/* Chain */}
          <div className="card">
            <h3>The chain</h3>
            <div className="stack">
              <div>
                <small>Fed by</small>
                <div className="chain">
                  {fedBy.length === 0 && <span className="faint">—</span>}
                  {fedBy.map((x) => (
                    <span key={x.id} className="pill">
                      <i className="dot" style={{ background: kindColor(x.kind) }} />
                      <Link href={`/suitors/${x.id}`}>{x.name}</Link>
                      <form action={deleteLink.bind(null, x.id, id)} className="inline"><button className="ghost" style={{ padding: 0 }}>✕</button></form>
                    </span>
                  ))}
                </div>
              </div>
              <div className="faint" style={{ textAlign: "center" }}>↓ {s.name} ↓</div>
              <div>
                <small>Feeds into</small>
                <div className="chain">
                  {feeds.length === 0 && <span className="faint">—</span>}
                  {feeds.map((x) => (
                    <span key={x.id} className="pill">
                      <i className="dot" style={{ background: kindColor(x.kind) }} />
                      <Link href={`/suitors/${x.id}`}>{x.name}</Link>
                      <form action={deleteLink.bind(null, id, x.id)} className="inline"><button className="ghost" style={{ padding: 0 }}>✕</button></form>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <form action={addLink.bind(null, id)} className="row" style={{ marginTop: 12 }}>
              <select name="direction" style={{ width: "auto" }} defaultValue="feeds">
                <option value="feeds">Feeds into</option>
                <option value="fed_by">Is fed by</option>
              </select>
              <select name="other" style={{ flex: 1, minWidth: 0 }} required defaultValue="">
                <option value="" disabled>Choose a suitor…</option>
                {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <button>Link</button>
            </form>
          </div>

          {/* Notes */}
          <div className="card">
            <div className="spread"><h3>Notes guarding against it</h3><Link href="/rooms" className="muted">Rooms →</Link></div>
            {notes.length === 0 && <p className="muted">No handwritten notes yet. Write one and put it where this gets in.</p>}
            <div className="grid">
              {notes.map((n) => (
                <div key={n.id} className={`note-card ${n.status}`}>
                  <div className="handwritten">{n.text}</div>
                  <small style={{ opacity: 0.7 }}>📍 {n.location} · {n.status}</small>
                </div>
              ))}
            </div>
          </div>

          {/* Encounters */}
          <div className="card">
            <div className="spread"><h3>Recent encounters</h3><Link href={`/log?suitor=${id}`} className="muted">Log one →</Link></div>
            <ul className="list">
              {encounters.map((e) => (
                <li key={e.id}>
                  <div className="spread">
                    <small>{formatWhen(e.occurred_at, tz)}{e.location ? ` · 📍 ${e.location}` : ""}</small>
                    <span className={`pill ${e.outcome === "gave_in" ? "ember" : "ok"}`}>{OUTCOMES[e.outcome]}</span>
                  </div>
                  {e.trigger_text && <div className="muted">{e.trigger_text}</div>}
                </li>
              ))}
              {encounters.length === 0 && <li className="muted">None logged.</li>}
            </ul>
          </div>

          <form action={deleteSuitor.bind(null, id)}>
            <button className="danger">Delete this suitor</button>
          </form>
        </div>
      </div>
    </>
  );
}
