import Link from "next/link";
import { Orbit, type OrbitOccupant, type OrbitSuitor } from "@/components/Orbit";
import { sql } from "@/lib/db";
import { as, getIdentity, houseLight } from "@/lib/queries";
import { HOUSEHOLD, IDENTITY, SUITOR_KINDS } from "@/lib/kinds";
import { todayIn, userTimeZone } from "@/lib/time";
import type { Occupant, Suitor } from "@/lib/types";

const OrbitIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <circle cx="12" cy="12" r="3.2" />
    <ellipse cx="12" cy="12" rx="10" ry="5.5" />
    <circle cx="20.5" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

export default async function HallPage() {
  const tz = await userTimeZone();
  const db = sql();
  const since = todayIn(tz, -6);
  const [suitors, occupants, links, reps, recent, kept, light, identity] = await Promise.all([
    db`select * from suitors where status <> 'evicted' order by weight desc`.then(as<Suitor>),
    db`select * from occupants where active`.then(as<Occupant>),
    db`select from_id, to_id from suitor_links`.then(as<{ from_id: number; to_id: number }>),
    db`select suitor_id, occupant_id from replacements`.then(as<{ suitor_id: number; occupant_id: number }>),
    db`select suitor_id, count(*)::int as n from encounters
       where occurred_at > now() - interval '3 days' group by suitor_id`.then(as<{ suitor_id: number; n: number }>),
    db`select occupant_id, count(*)::int as n from day_practices where day >= ${since}::date group by occupant_id`
      .then(as<{ occupant_id: number; n: number }>),
    houseLight(tz),
    getIdentity(),
  ]);
  const evicted = (await db`select id, name from suitors where status = 'evicted' order by evicted_at desc`) as { id: number; name: string }[];

  const recentBy = new Map(recent.map((r) => [r.suitor_id, r.n]));
  const keptBy = new Map(kept.map((r) => [r.occupant_id, r.n]));
  const live = new Set(suitors.map((s) => s.id));

  const orbitSuitors: OrbitSuitor[] = suitors.map((s) => ({
    id: s.id, name: s.name, kind: s.kind, weight: s.weight, status: s.status, root: s.is_root,
    recent: recentBy.get(s.id) ?? 0, lie: s.lie,
    feeds: links.filter((l) => l.from_id === s.id && live.has(l.to_id)).map((l) => l.to_id),
  }));

  // The household orbits closest: truths that stand guard, and practices actually kept this week.
  const orbitOccupants: OrbitOccupant[] = occupants
    .map((o) => ({
      id: o.id, name: o.name, reference: o.reference, kind: o.kind, kept: keptBy.get(o.id) ?? 0,
      replaces: reps.filter((r) => r.occupant_id === o.id && live.has(r.suitor_id)).map((r) => r.suitor_id),
    }))
    .filter((o) => (o.kind === "practice" ? o.kept > 0 : o.replaces.length > 0));

  const evicting = suitors.filter((s) => s.status === "evicting");
  const root = suitors.find((s) => s.is_root);
  const pct = Math.round(light.light * 100);

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div>
            <h1 className="card-title" style={{ fontSize: "1.2rem" }}><OrbitIcon /> What&rsquo;s orbiting my life</h1>
            <p className="card-sub">Everything occupying the house right now, circling who you are. Bigger means it takes more room. Tap anything to open it.</p>
          </div>
          <div style={{ minWidth: 210 }}>
            <div className="spread"><small style={{ fontWeight: 600 }}>Light in the house</small><strong style={{ color: IDENTITY.fg }}>{pct}%</strong></div>
            <div className="meter" style={{ marginTop: 6 }}><div style={{ width: `${Math.max(2, pct)}%` }} /></div>
            <small className="faint">{Math.round(light.occupied * 100)}% practices kept · {Math.round(light.evicted * 100)}% evicted</small>
          </div>
        </div>

        {suitors.length === 0 && orbitOccupants.length === 0 && !identity.text && (
          <p className="muted" style={{ textAlign: "center" }}>
            The house is quiet. Start with who you are in the centre, then <Link href="/suitors">name what&rsquo;s occupying it</Link>.
          </p>
        )}
        <Orbit suitors={orbitSuitors} occupants={orbitOccupants} identity={identity} light={light.light} />

        <div className="legend">
          <span style={{ background: IDENTITY.bg, color: IDENTITY.fg }}>Who I am</span>
          <span style={{ background: HOUSEHOLD.bg, color: HOUSEHOLD.fg }}>The household</span>
          {Object.entries(SUITOR_KINDS).map(([k, v]) => (
            <span key={k} style={{ background: v.bg, color: v.fg }}>{v.label}</span>
          ))}
          <span style={{ background: "#f5f7fb", color: "#646a80" }}>Dashed ring = being evicted · pulsing = showed up in the last 3 days</span>
        </div>
      </div>

      <div className="grid-2 section">
        <div className="card">
          <div className="card-head" style={{ marginBottom: 6 }}>
            <div>
              <h2 className="card-title">Who&rsquo;s being evicted</h2>
              <p className="card-sub">And what&rsquo;s taking their room.</p>
            </div>
          </div>
          {evicting.length === 0 ? (
            <p className="muted">No one yet. Pick one suitor, give its room to something better, and set it to &ldquo;being evicted&rdquo;.</p>
          ) : (
            <ul className="list">
              {evicting.map((s) => (
                <li key={s.id} className="spread">
                  <Link href={`/suitors/${s.id}`} style={{ fontWeight: 600, textDecoration: "none" }}>{s.name}</Link>
                  <span className="pill gold">{reps.filter((r) => r.suitor_id === s.id).length} occupying its room</span>
                </li>
              ))}
            </ul>
          )}
          <div className="row" style={{ marginTop: 14 }}>
            <Link className="btn primary" href="/rhythm">Today&rsquo;s rhythm</Link>
            <Link className="btn" href="/log">Log an encounter</Link>
          </div>
        </div>

        <div className="card">
          <blockquote className="quote" style={{ margin: 0, fontSize: "1.05rem" }}>
            &ldquo;When it arrives, it finds the house unoccupied, swept clean and put in order. Then it goes and takes with it seven other spirits more wicked than itself.&rdquo;
            <cite>Matthew 12:44–45 · so don&rsquo;t just evict, occupy.</cite>
          </blockquote>
          <p className="muted" style={{ marginTop: 14, fontSize: "0.9rem" }}>
            Odysseus came home after twenty years, disguised as a beggar. No one knew him, except Argus, his old dog, who lifted his head and knew his master. Whatever orbits you, the centre stays true.
          </p>
          {root && (
            <p style={{ marginTop: 6 }}>
              <small>First domino: </small><Link href={`/suitors/${root.id}`} style={{ fontWeight: 600 }}>{root.name}</Link>
            </p>
          )}
          {evicted.length > 0 && (
            <p className="muted" style={{ marginTop: 8 }}>
              Evicted: {evicted.map((e, i) => (
                <span key={e.id}>{i > 0 && ", "}<Link href={`/suitors/${e.id}`}>{e.name}</Link></span>
              ))}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
