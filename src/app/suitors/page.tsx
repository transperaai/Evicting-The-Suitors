import Link from "next/link";
import { createSuitor } from "@/app/actions";
import { sql } from "@/lib/db";
import { as } from "@/lib/queries";
import { STATUSES, SUITOR_KINDS, kindColor, kindLabel } from "@/lib/kinds";
import type { Suitor } from "@/lib/types";

type Row = Suitor & { triggers: number; occupants: number; encounters: number };

export default async function SuitorsPage() {
  const rows = as<Row>(await sql()`
    select s.*,
      (select count(*)::int from triggers t where t.suitor_id = s.id) as triggers,
      (select count(*)::int from replacements r where r.suitor_id = s.id) as occupants,
      (select count(*)::int from encounters e where e.suitor_id = s.id and e.occurred_at > now() - interval '30 days') as encounters
    from suitors s order by s.is_root desc, s.weight desc, s.name`);

  const groups = (["evicting", "occupying", "evicted"] as const).map((st) => [st, rows.filter((r) => r.status === st)] as const);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>The Suitors</h1>
          <p>Everything that has moved in: fears, habits, loops, lies, the sleep pattern, the inaction. Name each one, find the lie underneath it, see how it gets in, and decide what takes its room.</p>
        </div>
      </div>

      <form action={createSuitor} className="card" style={{ marginBottom: 28 }}>
        <h3>Name a suitor</h3>
        <div className="fields">
          <div style={{ gridColumn: "span 2" }}>
            <label htmlFor="name">What is it?</label>
            <input id="name" name="name" placeholder="e.g. Checking Instagram the moment I wake up" required />
          </div>
          <div>
            <label htmlFor="kind">Kind</label>
            <select id="kind" name="kind" defaultValue="habit">
              {Object.entries(SUITOR_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="weight">How much room it takes (1–5)</label>
            <input id="weight" name="weight" type="number" min={1} max={5} defaultValue={3} />
          </div>
        </div>
        <button className="primary" style={{ marginTop: 12 }}>Name it</button>
      </form>

      {groups.map(([st, list]) => list.length > 0 && (
        <section key={st} className="section">
          <h2>{STATUSES[st]} <span className="faint" style={{ fontSize: "1rem" }}>· {list.length}</span></h2>
          <div className="grid-3">
            {list.map((s) => (
              <Link key={s.id} href={`/suitors/${s.id}`} className="card card-link">
                <div className="spread" style={{ marginBottom: 6 }}>
                  <span className="row" style={{ gap: 8 }}>
                    <i className="dot" style={{ background: kindColor(s.kind) }} />
                    <small>{kindLabel(s.kind)}</small>
                  </span>
                  <span className="row" style={{ gap: 6 }}>
                    {s.is_root && <span className="pill ember">first domino</span>}
                    <small className="faint">{"●".repeat(s.weight)}</small>
                  </span>
                </div>
                <h3 style={{ marginBottom: 6 }}>{s.name}</h3>
                {s.lie && <p className="muted serif" style={{ fontStyle: "italic" }}>&ldquo;{s.lie}&rdquo;</p>}
                <div className="row" style={{ gap: 6 }}>
                  <span className="pill">{s.triggers} triggers</span>
                  <span className={`pill ${s.occupants ? "gold" : ""}`}>{s.occupants ? `${s.occupants} occupying its room` : "room empty"}</span>
                  {s.encounters > 0 && <span className="pill ember">{s.encounters}× in 30 days</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
