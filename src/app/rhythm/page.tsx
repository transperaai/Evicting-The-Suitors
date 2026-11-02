import Link from "next/link";
import { saveDay } from "@/app/actions";
import { sql } from "@/lib/db";
import { as } from "@/lib/queries";
import { formatDay, hhmm, sleepHours, todayIn, userTimeZone } from "@/lib/time";
import type { Day, Occupant, Suitor } from "@/lib/types";

const shift = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export default async function RhythmPage({ searchParams }: { searchParams: Promise<{ day?: string; saved?: string }> }) {
  const sp = await searchParams;
  const tz = await userTimeZone();
  const today = todayIn(tz);
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : today;
  const db = sql();

  const [days, kept, practices, campaign, campaignOcc, history] = await Promise.all([
    db`select *, day::text as day, slept_at::text, woke_at::text, bedtime_target::text
       from days where day in (${day}::date, ${shift(day, -1)}::date)`.then(as<Day>),
    db`select occupant_id from day_practices where day = ${day}::date`.then(as<{ occupant_id: number }>),
    db`select * from occupants where active and kind = 'practice' order by name`.then(as<Occupant>),
    db`select * from suitors where status = 'evicting' order by is_root desc, weight desc`.then(as<Suitor>),
    db`select r.suitor_id, o.* from replacements r join occupants o on o.id = r.occupant_id
       join suitors s on s.id = r.suitor_id where s.status = 'evicting' and o.active order by o.kind desc, o.name`
      .then(as<Occupant & { suitor_id: number }>),
    db`select d.day::text as day, d.slept_at::text, d.woke_at::text,
         (select count(*)::int from day_practices p where p.day = d.day) as kept
       from days d where d.day <= ${day}::date and d.day > ${day}::date - 14 order by d.day desc`
      .then(as<{ day: string; slept_at: string | null; woke_at: string | null; kept: number }>),
  ]);

  const d = days.find((x) => x.day === day);
  const yesterday = days.find((x) => x.day === shift(day, -1));
  const keptSet = new Set(kept.map((k) => k.occupant_id));
  const inCampaign = new Set(campaignOcc.filter((o) => o.kind === "practice").map((o) => o.id));
  const byRhythm = (r: string) => practices.filter((p) => p.rhythm === r && !inCampaign.has(p.id));

  const Practice = ({ o }: { o: Occupant }) => (
    <label className="check">
      <input type="checkbox" name="practice" value={o.id} defaultChecked={keptSet.has(o.id)} />
      <span>{o.name}{o.content && <small className="muted">{o.content}</small>}</span>
    </label>
  );

  const hours = sleepHours(d?.slept_at, d?.woke_at);
  const maxH = 10;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Rhythm</h1>
          <p>Each day is part of the fight. Keep the practices that occupy the rooms you&rsquo;re taking back, plan tomorrow so your mind doesn&rsquo;t have to at 1am, and close the house properly.</p>
        </div>
        <div className="row">
          <Link className="btn" href={`/rhythm?day=${shift(day, -1)}`}>←</Link>
          <span className="serif">{day === today ? "Today" : formatDay(day)}</span>
          {day < today && <Link className="btn" href={`/rhythm?day=${shift(day, 1)}`}>→</Link>}
          {day !== today && <Link className="btn" href="/rhythm">Today</Link>}
        </div>
      </div>
      {sp.saved && <div className="flash ok">Saved. The house is a little more occupied.</div>}

      <div className="grid-2">
        <form action={saveDay.bind(null, day)} className="grid" style={{ alignContent: "start" }}>
          {/* The campaign */}
          <div className="card gold">
            <h2>Who you&rsquo;re evicting</h2>
            {campaign.length === 0 && (
              <p className="muted">No suitor is being evicted yet. Open one on the <Link href="/suitors">Suitors</Link> page, give its room to truths and practices, then set it to <em>being evicted</em>.</p>
            )}
            {campaign.map((s) => {
              const occ = campaignOcc.filter((o) => o.suitor_id === s.id);
              return (
                <div key={s.id} style={{ marginTop: 14 }}>
                  <h3><Link href={`/suitors/${s.id}`}>{s.name}</Link></h3>
                  {s.lie && <small className="muted">The lie: &ldquo;{s.lie}&rdquo;</small>}
                  <div style={{ marginTop: 6 }}>
                    {occ.filter((o) => o.kind === "practice").map((o) => <Practice key={o.id} o={o} />)}
                    {occ.filter((o) => o.kind === "truth").map((o) => (
                      <blockquote key={o.id} className="quote" style={{ margin: "8px 0 0", fontSize: "0.98rem" }}>
                        &ldquo;{o.content ?? o.name}&rdquo;<cite>{o.reference ?? o.name}</cite>
                      </blockquote>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Morning */}
          <div className="card">
            <h2>Morning</h2>
            <div className="fields">
              <div><label>Fell asleep at</label><input type="time" name="slept_at" defaultValue={hhmm(d?.slept_at)} /></div>
              <div><label>Woke at</label><input type="time" name="woke_at" defaultValue={hhmm(d?.woke_at)} /></div>
            </div>
            {hours != null && <p className="muted" style={{ marginTop: 8 }}>{hours} hours of sleep.</p>}
            {yesterday && (yesterday.plan1 || yesterday.plan2 || yesterday.plan3) && (
              <div style={{ marginTop: 10 }}>
                <small>Today&rsquo;s three (planned last night)</small>
                <ol style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                  {[yesterday.plan1, yesterday.plan2, yesterday.plan3].filter(Boolean).map((p, i) => <li key={i}>{p}</li>)}
                </ol>
              </div>
            )}
            <div style={{ marginTop: 8 }}>{byRhythm("morning").map((o) => <Practice key={o.id} o={o} />)}</div>
          </div>

          {byRhythm("daily").length > 0 && (
            <div className="card">
              <h2>Through the day</h2>
              {byRhythm("daily").map((o) => <Practice key={o.id} o={o} />)}
            </div>
          )}

          {/* Evening */}
          <div className="card">
            <h2>Evening: close the house</h2>
            <div className="field">
              <label>What&rsquo;s still circling? Write it here and hand it over. It doesn&rsquo;t need solving tonight.</label>
              <textarea name="handed_over" defaultValue={d?.handed_over ?? ""} rows={4} />
            </div>
            <label>Tomorrow&rsquo;s top three, so you don&rsquo;t have to plan it in bed</label>
            <div className="grid" style={{ gap: 8 }}>
              <input name="plan1" defaultValue={d?.plan1 ?? ""} placeholder="1." />
              <input name="plan2" defaultValue={d?.plan2 ?? ""} placeholder="2." />
              <input name="plan3" defaultValue={d?.plan3 ?? ""} placeholder="3." />
            </div>
            <div className="fields" style={{ marginTop: 12 }}>
              <div><label>Lights out by</label><input type="time" name="bedtime_target" defaultValue={hhmm(d?.bedtime_target)} /></div>
            </div>
            <div className="field" style={{ marginTop: 12 }}><label>Thank Him for…</label><input name="gratitude" defaultValue={d?.gratitude ?? ""} /></div>
            {byRhythm("evening").map((o) => <Practice key={o.id} o={o} />)}
          </div>

          <div className="card">
            <div className="field"><label>Reflection: where did a suitor get in today, and what will you prepare?</label>
              <textarea name="reflection" defaultValue={d?.reflection ?? ""} /></div>
            <button className="primary">Save the day</button>
          </div>
        </form>

        <div className="grid" style={{ alignContent: "start" }}>
          <div className="card">
            <h3>Last 14 days</h3>
            {history.length === 0 && <p className="muted">Nothing recorded yet.</p>}
            <div className="bars">
              {history.map((h) => {
                const hrs = sleepHours(h.slept_at, h.woke_at);
                return (
                  <Link key={h.day} href={`/rhythm?day=${h.day}`} className="bar-row" style={{ textDecoration: "none" }}>
                    <small>{formatDay(h.day).split(" ").slice(0, 3).join(" ")}</small>
                    <div className="track"><div className={`fill ${hrs != null && hrs < 6.5 ? "ember" : ""}`} style={{ width: `${Math.min(100, ((hrs ?? 0) / maxH) * 100)}%` }} /></div>
                    <small className="muted">{hrs != null ? `${hrs}h` : "—"}</small>
                  </Link>
                );
              })}
            </div>
            {history.length > 0 && (
              <p className="faint" style={{ marginTop: 10, fontSize: "0.82rem" }}>
                Bedtimes: {history.filter((h) => h.slept_at).map((h) => hhmm(h.slept_at)).join(" · ") || "—"}
              </p>
            )}
          </div>
          <div className="card">
            <blockquote className="quote" style={{ margin: 0 }}>
              &ldquo;It is in vain that you rise up early and go late to rest, eating the bread of anxious toil; for he gives to his beloved sleep.&rdquo;
              <cite>Psalm 127:2</cite>
            </blockquote>
          </div>
        </div>
      </div>
    </>
  );
}
