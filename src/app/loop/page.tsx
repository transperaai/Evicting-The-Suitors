import { handOver } from "@/app/actions";
import { sql } from "@/lib/db";
import { allLocations, as } from "@/lib/queries";
import type { Occupant, Suitor } from "@/lib/types";

export default async function LoopPage({ searchParams }: { searchParams: Promise<{ handed?: string }> }) {
  const { handed } = await searchParams;
  const db = sql();
  const [loops, truths, interrupts, locations] = await Promise.all([
    db`select id, name, kind from suitors where status <> 'evicted' order by (kind = 'loop') desc, weight desc, name`
      .then(as<Pick<Suitor, "id" | "name" | "kind">>),
    // Truths standing guard over loops and fears first, then any "in the moment" truth.
    db`select distinct on (o.id) o.*, (s.kind in ('loop', 'fear')) as guard from occupants o
       left join replacements r on r.occupant_id = o.id left join suitors s on s.id = r.suitor_id
       where o.active and o.kind = 'truth' and (s.kind in ('loop', 'fear') or o.rhythm = 'moment')
       order by o.id, guard desc`.then(as<Occupant>),
    db`select * from occupants where active and kind = 'practice' and rhythm = 'moment' order by id`.then(as<Occupant>),
    allLocations(),
  ]);
  const shown = truths.sort(() => Math.random() - 0.5).slice(0, 3);

  if (handed) {
    return (
      <div style={{ maxWidth: 640, margin: "6vh auto", textAlign: "center" }}>
        <p className="big-statement">It&rsquo;s written down. It&rsquo;s in His hands.</p>
        <p className="muted">You don&rsquo;t have to hold it tonight. Tomorrow, at the desk, you can look at it with a clear head.</p>
        <blockquote className="quote" style={{ margin: "24px 0" }}>
          &ldquo;In peace I will both lie down and sleep; for you alone, O LORD, make me dwell in safety.&rdquo;
          <cite>Psalm 4:8</cite>
        </blockquote>
        <p className="serif" style={{ fontSize: "1.2rem" }}>Close the laptop. Lights out.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <p className="muted">You noticed it. That&rsquo;s the hardest part.</p>
      <p className="big-statement">&ldquo;I am looking for certainty.<br />It won&rsquo;t be found here.&rdquo;</p>
      <p className="muted">Say it out loud. Rumination promises an answer if you go round one more time. It never gives one. Certainty comes from trusting Him, not from going over it again.</p>

      {interrupts.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          {interrupts.map((o) => (
            <p key={o.id} style={{ margin: "4px 0" }}><strong>{o.name}.</strong> <span className="muted">{o.content}</span></p>
          ))}
        </div>
      )}

      <div className="grid" style={{ marginTop: 20 }}>
        {shown.map((t) => (
          <div key={t.id} className="card gold">
            <blockquote className="quote" style={{ margin: 0 }}>&ldquo;{t.content ?? t.name}&rdquo;<cite>{t.reference ?? t.name}</cite></blockquote>
          </div>
        ))}
      </div>

      <form action={handOver} className="card" style={{ marginTop: 20 }}>
        <h3>Write it down and hand it over</h3>
        <p className="muted" style={{ fontSize: "0.9rem" }}>Get the whole loop out of your head and onto the page, then pray it over. It gets saved to today&rsquo;s rhythm so you can deal with it tomorrow in daylight.</p>
        <div className="field"><textarea name="thought" rows={5} placeholder="What's going round in your head…" /></div>
        <div className="fields">
          <div>
            <label>Which suitor is this?</label>
            <select name="suitor" defaultValue={loops.find((l) => l.kind === "loop")?.id ?? ""}>
              <option value="">—</option>
              {loops.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div><label>Where are you?</label><input name="location" list="locations" placeholder="e.g. Bedroom" /></div>
          <div><label>What set it off?</label><input name="trigger_text" /></div>
        </div>
        <button className="primary" style={{ marginTop: 12 }}>Hand it over</button>
        <datalist id="locations">{locations.map((l) => <option key={l} value={l} />)}</datalist>
      </form>
    </div>
  );
}
