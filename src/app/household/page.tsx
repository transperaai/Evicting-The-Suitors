import Link from "next/link";
import { createOccupant, deleteOccupant, updateOccupant } from "@/app/actions";
import { sql } from "@/lib/db";
import { as } from "@/lib/queries";
import { RHYTHMS } from "@/lib/kinds";
import { todayIn, userTimeZone } from "@/lib/time";
import type { Occupant } from "@/lib/types";

type Row = Occupant & { suitors: { id: number; name: string }[] | null; kept: number };

export default async function HouseholdPage() {
  const tz = await userTimeZone();
  const since = todayIn(tz, -6);
  const rows = as<Row>(await sql()`
    select o.*,
      (select json_agg(json_build_object('id', s.id, 'name', s.name) order by s.name)
         from replacements r join suitors s on s.id = r.suitor_id where r.occupant_id = o.id) as suitors,
      (select count(*)::int from day_practices d where d.occupant_id = o.id and d.day >= ${since}::date) as kept
    from occupants o order by o.active desc, o.rhythm, o.name`);

  const truths = rows.filter((r) => r.kind === "truth");
  const practices = rows.filter((r) => r.kind === "practice");

  const Item = ({ o }: { o: Row }) => (
    <div id={`o${o.id}`} className={`card ${o.active ? "gold" : ""}`} style={{ opacity: o.active ? 1 : 0.55, scrollMarginTop: 90 }}>
      <div className="spread" style={{ marginBottom: 6 }}>
        <small className="muted">{RHYTHMS[o.rhythm as keyof typeof RHYTHMS] ?? o.rhythm}</small>
        {o.kind === "practice" && <span className={`pill ${o.kept ? "gold" : ""}`}>{o.kept}/7 this week</span>}
      </div>
      <h3>{o.name}</h3>
      {o.content && (
        <p className={o.kind === "truth" ? "quote" : "muted"}>
          {o.kind === "truth" ? <>&ldquo;{o.content}&rdquo;</> : o.content}
          {o.reference && <cite>{o.reference}</cite>}
        </p>
      )}
      {o.suitors && (
        <div className="row" style={{ gap: 6 }}>
          <small className="faint">Occupies the room of:</small>
          {o.suitors.map((s) => <Link key={s.id} className="pill" href={`/suitors/${s.id}`}>{s.name}</Link>)}
        </div>
      )}
      <details style={{ marginTop: 10 }}>
        <summary className="muted" style={{ cursor: "pointer", fontSize: "0.88rem" }}>Edit</summary>
        <form action={updateOccupant.bind(null, o.id)} style={{ marginTop: 10 }}>
          <div className="field"><label>Name</label><input name="name" defaultValue={o.name} required /></div>
          <div className="fields">
            <div><label>Kind</label><select name="kind" defaultValue={o.kind}><option value="truth">Truth</option><option value="practice">Practice</option></select></div>
            <div><label>Reference</label><input name="reference" defaultValue={o.reference ?? ""} /></div>
            <div><label>When</label><select name="rhythm" defaultValue={o.rhythm}>{Object.entries(RHYTHMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div className="field" style={{ marginTop: 10 }}><label>Verse / how</label><textarea name="content" defaultValue={o.content ?? ""} /></div>
          <label className="check"><input type="checkbox" name="active" defaultChecked={o.active} /> Living here (active)</label>
          <div className="row"><button className="primary">Save</button></div>
        </form>
        <form action={deleteOccupant.bind(null, o.id)} style={{ marginTop: 8 }}><button className="danger">Remove from the household</button></form>
      </details>
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>The Household</h1>
          <p>What lives in the house instead. <strong>Truths</strong> are the scripture you choose to answer each lie. <strong>Practices</strong> are what you actually do: the habits that keep the house occupied with Jesus so nothing has an empty room to come back to.</p>
        </div>
      </div>

      <details className="card" style={{ marginBottom: 28 }}>
        <summary style={{ cursor: "pointer" }}><strong>Add to the household</strong></summary>
        <form action={createOccupant} style={{ marginTop: 12 }}>
          <div className="fields">
            <div><label>Kind</label><select name="kind" defaultValue="truth"><option value="truth">Truth (scripture)</option><option value="practice">Practice</option></select></div>
            <div><label>Reference</label><input name="reference" placeholder="e.g. Isaiah 41:10" /></div>
            <div><label>When</label><select name="rhythm" defaultValue="daily">{Object.entries(RHYTHMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          </div>
          <div className="field" style={{ marginTop: 10 }}><label>Name</label><input name="name" required placeholder="Short name you'll recognise" /></div>
          <div className="field"><label>The verse, or how you&rsquo;ll do it</label><textarea name="content" /></div>
          <button className="primary">Add</button>
        </form>
      </details>

      <section>
        <h2>Practices <span className="faint" style={{ fontSize: "1rem" }}>· {practices.length}</span></h2>
        <div className="grid-3">{practices.map((o) => <Item key={o.id} o={o} />)}</div>
      </section>
      <section className="section">
        <h2>Truths <span className="faint" style={{ fontSize: "1rem" }}>· {truths.length}</span></h2>
        <div className="grid-3">{truths.map((o) => <Item key={o.id} o={o} />)}</div>
      </section>
    </>
  );
}
