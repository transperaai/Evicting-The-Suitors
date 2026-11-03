import Link from "next/link";
import { deleteEncounter, logEncounter } from "@/app/actions";
import { sql } from "@/lib/db";
import { allLocations, as, recentEncounters } from "@/lib/queries";
import { OUTCOMES, kindColor } from "@/lib/kinds";
import { formatWhen, nowLocalInput, userTimeZone } from "@/lib/time";
import type { Suitor } from "@/lib/types";

export default async function LogPage({ searchParams }: { searchParams: Promise<{ suitor?: string; logged?: string }> }) {
  const sp = await searchParams;
  const tz = await userTimeZone();
  const db = sql();
  const [suitors, encounters, locations, hours, rooms, outcomes] = await Promise.all([
    db`select id, name from suitors where status <> 'evicted' order by name`.then(as<Pick<Suitor, "id" | "name">>),
    recentEncounters(40),
    allLocations(),
    db`select extract(hour from occurred_at at time zone ${tz})::int as h, count(*)::int as n
       from encounters where occurred_at > now() - interval '30 days' group by 1 order by 1`.then(as<{ h: number; n: number }>),
    db`select coalesce(location, 'Unknown') as location, count(*)::int as n from encounters
       where occurred_at > now() - interval '30 days' group by 1 order by 2 desc limit 6`.then(as<{ location: string; n: number }>),
    db`select outcome, count(*)::int as n from encounters where occurred_at > now() - interval '30 days' group by 1`
      .then(as<{ outcome: keyof typeof OUTCOMES; n: number }>),
  ]);

  const maxHour = Math.max(1, ...hours.map((h) => h.n));
  const maxRoom = Math.max(1, ...rooms.map((r) => r.n));
  const total = outcomes.reduce((a, b) => a + b.n, 0);
  const won = outcomes.filter((o) => o.outcome !== "gave_in").reduce((a, b) => a + b.n, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Encounters</h1>
          <p>Every time a suitor shows up, log where and what set it off. You&rsquo;re not doing this to judge yourself. You&rsquo;re doing it so you can see the doors and prepare for them.</p>
        </div>
      </div>
      {sp.logged && <div className="flash ok">Logged. Now you know a little more about how it gets in.</div>}

      <div className="grid-2">
        <form action={logEncounter} className="card">
          <h3>A suitor showed up</h3>
          <div className="fields">
            <div>
              <label>Which one</label>
              <select name="suitor" defaultValue={sp.suitor ?? ""} required>
                <option value="" disabled>Choose…</option>
                {suitors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label>When</label><input type="datetime-local" name="occurred_at" defaultValue={nowLocalInput(tz)} /></div>
          </div>
          <div className="fields" style={{ marginTop: 12 }}>
            <div><label>Where (room / place)</label><input name="location" list="locations" placeholder="e.g. Bedroom" /></div>
            <div><label>Intensity (1–5)</label><input type="range" name="intensity" min={1} max={5} defaultValue={3} /></div>
          </div>
          <div className="field" style={{ marginTop: 12 }}><label>What set it off?</label><input name="trigger_text" placeholder="What happened right before?" /></div>
          <div className="fields">
            <div>
              <label>What happened</label>
              <select name="outcome" defaultValue="gave_in">
                {Object.entries(OUTCOMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label>Did a note help?</label>
              <select name="note_helped" defaultValue="">
                <option value="">—</option><option value="yes">Yes</option><option value="no">It was there, but no</option><option value="none">No note there</option>
              </select>
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}><label>What would you prepare differently?</label><textarea name="reflection" /></div>
          <button className="primary">Log it</button>
          <datalist id="locations">{locations.map((l) => <option key={l} value={l} />)}</datalist>
        </form>

        <div className="grid" style={{ alignContent: "start" }}>
          <div className="card">
            <h3>Last 30 days</h3>
            {total === 0 ? <p className="muted">No encounters logged yet.</p> : (
              <p>{total} encounters · <span style={{ color: "var(--gold)" }}>{won} resisted or redirected</span></p>
            )}
            {hours.length > 0 && (
              <>
                <small>When they come (hour of day)</small>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 2, alignItems: "end", height: 70, marginTop: 6 }}>
                  {Array.from({ length: 24 }, (_, h) => {
                    const n = hours.find((x) => x.h === h)?.n ?? 0;
                    return <div key={h} title={`${h}:00 · ${n}`} style={{ height: `${Math.max(3, (n / maxHour) * 100)}%`, background: n ? "var(--ember)" : "var(--track)", borderRadius: 2 }} />;
                  })}
                </div>
                <div className="spread faint" style={{ fontSize: "0.72rem" }}><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div>
              </>
            )}
            {rooms.length > 0 && (
              <div className="bars" style={{ marginTop: 14 }}>
                <small>Where they come</small>
                {rooms.map((r) => (
                  <div key={r.location} className="bar-row">
                    <small>{r.location}</small>
                    <div className="track"><div className="fill ember" style={{ width: `${(r.n / maxRoom) * 100}%` }} /></div>
                    <small className="muted">{r.n}</small>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3>Recent</h3>
            <ul className="list">
              {encounters.map((e) => (
                <li key={e.id}>
                  <div className="spread">
                    <span className="row" style={{ gap: 8 }}>
                      <i className="dot" style={{ background: kindColor(e.suitor_kind ?? "") }} />
                      {e.suitor_id ? <Link href={`/suitors/${e.suitor_id}`}>{e.suitor_name}</Link> : <span className="muted">Unnamed</span>}
                    </span>
                    <span className="row" style={{ gap: 4 }}>
                      <span className={`pill ${e.outcome === "gave_in" ? "ember" : "ok"}`}>{OUTCOMES[e.outcome]}</span>
                      <form action={deleteEncounter.bind(null, e.id)}><button className="ghost" title="Delete">✕</button></form>
                    </span>
                  </div>
                  <small className="muted">{formatWhen(e.occurred_at, tz)}{e.location ? ` · 📍 ${e.location}` : ""}{e.trigger_text ? ` · ${e.trigger_text}` : ""}</small>
                  {e.reflection && <div className="faint" style={{ fontSize: "0.88rem" }}>{e.reflection}</div>}
                </li>
              ))}
              {encounters.length === 0 && <li className="muted">Nothing yet.</li>}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
