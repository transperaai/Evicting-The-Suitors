import Link from "next/link";
import { Hall, type HallLink, type HallNode } from "@/components/Hall";
import { sql } from "@/lib/db";
import { as, houseLight } from "@/lib/queries";
import { GOLD, SUITOR_KINDS, kindColor, kindLabel } from "@/lib/kinds";
import { todayIn, userTimeZone } from "@/lib/time";
import type { Occupant, Suitor } from "@/lib/types";

export default async function HallPage() {
  const tz = await userTimeZone();
  const db = sql();
  const since = todayIn(tz, -6);
  const [suitors, occupants, links, reps, recent, kept, light] = await Promise.all([
    db`select * from suitors where status <> 'evicted' order by weight desc`.then(as<Suitor>),
    db`select * from occupants where active`.then(as<Occupant>),
    db`select from_id, to_id from suitor_links`.then(as<{ from_id: number; to_id: number }>),
    db`select suitor_id, occupant_id from replacements`.then(as<{ suitor_id: number; occupant_id: number }>),
    db`select suitor_id, count(*)::int as n from encounters
       where occurred_at > now() - interval '3 days' group by suitor_id`.then(as<{ suitor_id: number; n: number }>),
    db`select occupant_id, count(*)::int as n from day_practices where day >= ${since}::date group by occupant_id`
      .then(as<{ occupant_id: number; n: number }>),
    houseLight(tz),
  ]);
  const evicted = (await db`select id, name from suitors where status = 'evicted' order by evicted_at desc`) as { id: number; name: string }[];

  const recentBy = new Map(recent.map((r) => [r.suitor_id, r.n]));
  const keptBy = new Map(kept.map((r) => [r.occupant_id, r.n]));
  const repCount = new Map<number, number>();
  for (const r of reps) repCount.set(r.occupant_id, (repCount.get(r.occupant_id) ?? 0) + 1);

  const live = new Set(suitors.map((s) => s.id));
  const nodes: HallNode[] = [
    ...suitors.map((s) => ({
      id: `s${s.id}`, group: "suitor" as const, label: s.name,
      detail: [kindLabel(s.kind), s.lie ? `Lie: “${s.lie}”` : null, s.status === "evicting" ? "Being evicted" : null]
        .filter(Boolean).join(" · "),
      color: kindColor(s.kind), r: 14 + s.weight * 6, href: `/suitors/${s.id}`,
      status: s.status, root: s.is_root, recent: recentBy.get(s.id) ?? 0,
      labeled: s.weight >= 4 || s.status === "evicting" || s.is_root || (recentBy.get(s.id) ?? 0) > 0,
    })),
    // The household only shows up when it's actually living here: practices kept this week, truths standing guard.
    ...occupants
      .filter((o) => (o.kind === "practice" ? (keptBy.get(o.id) ?? 0) > 0 : (repCount.get(o.id) ?? 0) > 0))
      .map((o) => ({
        id: `o${o.id}`, group: "occupant" as const,
        label: o.reference ? `${o.name} (${o.reference})` : o.name,
        detail: o.kind === "practice" ? `Kept ${keptBy.get(o.id)}× this week` : o.content ?? undefined,
        color: GOLD,
        r: o.kind === "practice" ? 6 + (keptBy.get(o.id) ?? 0) * 2.2 : 5 + (repCount.get(o.id) ?? 0) * 1.5,
        href: `/household#o${o.id}`,
      })),
  ];
  const hallLinks: HallLink[] = [
    ...links.filter((l) => live.has(l.from_id) && live.has(l.to_id))
      .map((l) => ({ source: `s${l.from_id}`, target: `s${l.to_id}`, type: "feeds" as const })),
    ...reps.filter((r) => live.has(r.suitor_id))
      .map((r) => ({ source: `o${r.occupant_id}`, target: `s${r.suitor_id}`, type: "replaces" as const })),
  ];

  const evicting = suitors.filter((s) => s.status === "evicting");
  const root = suitors.find((s) => s.is_root);
  const pct = Math.round(light.light * 100);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>The Hall</h1>
          <p>Everything occupying the house right now. Bigger means it takes up more of your life. A glow means it showed up in the last three days. Gold is what&rsquo;s living here instead. Hover for names, click to open.</p>
        </div>
        <div style={{ minWidth: 220 }}>
          <div className="spread"><small>Light in the house</small><strong className="serif" style={{ color: "var(--gold)" }}>{pct}%</strong></div>
          <div className="meter" style={{ marginTop: 6 }}><div style={{ width: `${Math.max(2, pct)}%` }} /></div>
          <small className="faint">{Math.round(light.occupied * 100)}% practices kept this week · {Math.round(light.evicted * 100)}% evicted</small>
        </div>
      </div>

      {suitors.length === 0 && occupants.length === 0 ? (
        <div className="card">
          <h2>The house is quiet.</h2>
          <p className="muted">Start by naming what&rsquo;s occupying it.</p>
          <Link className="btn primary" href="/suitors">Name a suitor</Link>
        </div>
      ) : (
        <>
          <Hall nodes={nodes} links={hallLinks} light={light.light} />
          <div className="legend">
            {Object.entries(SUITOR_KINDS).map(([k, v]) => (
              <span key={k}><i className="dot" style={{ background: v.color }} />{v.label}</span>
            ))}
            <span><i className="dot" style={{ background: GOLD, boxShadow: `0 0 8px ${GOLD}` }} />The household</span>
            <span className="faint">Dashed ring = being evicted, drifting toward the door</span>
          </div>
        </>
      )}

      <div className="grid-2 section">
        <div className="card gold">
          <h3>Who&rsquo;s being evicted</h3>
          {evicting.length === 0 ? (
            <p className="muted">No one yet. Pick one suitor, give its room to something better, and set it to &ldquo;being evicted&rdquo;.</p>
          ) : (
            <ul className="list">
              {evicting.map((s) => (
                <li key={s.id} className="spread">
                  <Link href={`/suitors/${s.id}`}>{s.name}</Link>
                  <span className="pill gold">{reps.filter((r) => r.suitor_id === s.id).length} occupying its room</span>
                </li>
              ))}
            </ul>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <Link className="btn primary" href="/rhythm">Today&rsquo;s rhythm</Link>
            <Link className="btn" href="/log">Log an encounter</Link>
          </div>
        </div>

        <div className="card">
          <blockquote className="quote" style={{ margin: 0 }}>
            &ldquo;When it arrives, it finds the house unoccupied, swept clean and put in order. Then it goes and takes with it seven other spirits more wicked than itself.&rdquo;
            <cite>Matthew 12:44–45 · so don&rsquo;t just evict, occupy.</cite>
          </blockquote>
          {root && (
            <p style={{ marginTop: 14 }}>
              <small>First domino: </small><Link href={`/suitors/${root.id}`}>{root.name}</Link>
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
