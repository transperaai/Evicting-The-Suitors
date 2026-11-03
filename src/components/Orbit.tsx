"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { updateIdentity } from "@/app/actions";
import { HOUSEHOLD, kindLabel, kindStyle } from "@/lib/kinds";

export type OrbitSuitor = {
  id: number;
  name: string;
  kind: string;
  weight: number;
  status: string;
  root: boolean;
  recent: number;
  lie: string | null;
  feeds: number[];
};

export type OrbitOccupant = {
  id: number;
  name: string;
  reference: string | null;
  kind: "truth" | "practice";
  kept: number;
  replaces: number[];
};

type Item = {
  key: string;
  r: number;
  ring: number;
  base: number; // arc-length position on its ring at t = 0
  suitor?: OrbitSuitor;
  occupant?: OrbitOccupant;
};

type Ring = { rx: number; ry: number; L: number; cum: Float64Array; xs: Float64Array; ys: Float64Array };

const SAMPLES = 720;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function makeRing(rx: number, ry: number): Ring {
  const xs = new Float64Array(SAMPLES + 1), ys = new Float64Array(SAMPLES + 1), cum = new Float64Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) {
    const a = (i / SAMPLES) * Math.PI * 2 - Math.PI / 2;
    xs[i] = Math.cos(a) * rx;
    ys[i] = Math.sin(a) * ry;
    if (i > 0) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  }
  return { rx, ry, L: cum[SAMPLES], cum, xs, ys };
}

/** Point at arc distance d along the ring (constant speed around an ellipse). */
function pointAt(ring: Ring, d: number) {
  const L = ring.L;
  d = ((d % L) + L) % L;
  let lo = 0, hi = SAMPLES;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ring.cum[mid] < d) lo = mid + 1; else hi = mid;
  }
  const i = Math.max(1, lo);
  const seg = ring.cum[i] - ring.cum[i - 1] || 1;
  const f = (d - ring.cum[i - 1]) / seg;
  return { x: ring.xs[i - 1] + (ring.xs[i] - ring.xs[i - 1]) * f, y: ring.ys[i - 1] + (ring.ys[i] - ring.ys[i - 1]) * f };
}

/** Spread items evenly along a ring, by their size. */
function place(items: Omit<Item, "base" | "ring">[], ring: Ring, ringIndex: number, gap: number): Item[] {
  const total = items.reduce((a, it) => a + it.r * 2 + gap, 0);
  const extra = Math.max(0, (ring.L - total) / Math.max(1, items.length));
  let d = 0;
  return items.map((it) => {
    const step = it.r * 2 + gap + extra;
    const placed = { ...it, ring: ringIndex, base: d + step / 2 };
    d += step;
    return placed;
  });
}

/** Big, small, big, small… so the heavy suitors don't clump together. */
function interleave<T>(arr: T[]) {
  const out: T[] = [];
  for (let i = 0, j = arr.length - 1; i <= j; i++, j--) {
    out.push(arr[i]);
    if (i !== j) out.push(arr[j]);
  }
  return out;
}

const shortName = (s: string) => s.replace(/\s*\([^)]*\)\s*/g, " ").split(/\s+[—–-]\s+/)[0].trim();

// px per second each ring travels (sign = direction)
const SPEEDS = [-9, 6, 4];

export function Orbit({
  suitors, occupants, identity, light,
}: {
  suitors: OrbitSuitor[];
  occupants: OrbitOccupant[];
  identity: { text: string | null; reference: string | null };
  light: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const pos = useRef(new Map<string, { x: number; y: number }>());
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<Item | null>(null);
  const [editing, setEditing] = useState(false);
  const paused = hover !== null || editing;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const { w, h } = size;
    if (!w || !h) return null;
    const s = clamp(Math.min(w, h) / 720, 0.55, 1.05);
    const sr = (x: OrbitSuitor) => (24 + x.weight * 7) * s;
    const hr = (o: OrbitOccupant) => (o.kind === "practice" ? (11 + Math.min(o.kept, 7) * 1.7) * s : 8 * s);
    const maxS = Math.max(30 * s, ...suitors.map(sr));
    const maxH = Math.max(8 * s, ...occupants.map(hr));
    const ax = w / 2 - maxS - 6, by = h / 2 - maxS - 6;
    const m = Math.min(ax, by);
    const rc = clamp(m * 0.34, 62, 120);
    const innerD = rc + maxH + 12 * s;
    const ringAD = innerD + maxH + maxS + 10 * s;
    const twoRings = m - ringAD >= maxS * 2 + 8;
    const fA = twoRings ? ringAD / m : Math.min(1, Math.max(ringAD / m, (ringAD + m) / 2 / m));
    const rings = [makeRing(ax * (innerD / m), by * (innerD / m)), makeRing(ax * fA, by * fA), makeRing(ax, by)];
    const gap = 10 * s;

    const household = place(
      interleave([...occupants].sort((a, b) => hr(b) - hr(a))).map((o) => ({ key: `o${o.id}`, r: hr(o), occupant: o })),
      rings[0], 0, 6 * s,
    );

    const toItem = (x: OrbitSuitor) => ({ key: `s${x.id}`, r: sr(x), suitor: x });
    let ringA: OrbitSuitor[] = [], ringB: OrbitSuitor[] = [];
    if (twoRings) {
      let used = 0;
      for (const x of [...suitors].sort((a, b) => b.weight - a.weight)) {
        const need = sr(x) * 2 + gap;
        if (x.status !== "evicting" && used + need <= rings[1].L * 0.92) { ringA.push(x); used += need; }
        else ringB.push(x);
      }
    } else {
      ringA = [...suitors].sort((a, b) => b.weight - a.weight);
    }
    const items = [
      ...household,
      ...place(interleave(ringA).map(toItem), rings[1], 1, gap),
      ...place(interleave(ringB).map(toItem), rings[2], 2, gap),
    ];
    return { items, rings, rc, s, used: [household.length > 0, ringA.length > 0, ringB.length > 0] };
  }, [size, suitors, occupants]);

  // Animate: move every orb along its ring. Direct DOM writes, no React re-render per frame.
  const tRef = useRef(0);
  useEffect(() => {
    if (!layout) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cx = size.w / 2, cy = size.h / 2;
    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!paused && !reduce) tRef.current += dt;
      for (const it of layout.items) {
        const p = pointAt(layout.rings[it.ring], it.base + tRef.current * SPEEDS[it.ring] * layout.s);
        const x = cx + p.x, y = cy + p.y;
        pos.current.set(it.key, { x, y });
        const el = els.current.get(it.key);
        if (el) el.style.transform = `translate(${x - it.r}px, ${y - it.r}px)`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [layout, paused, size]);

  // Who is related to the hovered orb
  const related = useMemo(() => {
    if (!hover) return null;
    const keys = new Set<string>([hover.key]);
    const lines: { from: string; to: string; type: "feeds" | "replaces" }[] = [];
    if (hover.suitor) {
      for (const f of hover.suitor.feeds) { keys.add(`s${f}`); lines.push({ from: hover.key, to: `s${f}`, type: "feeds" }); }
      for (const x of suitors) if (x.feeds.includes(hover.suitor.id)) { keys.add(`s${x.id}`); lines.push({ from: `s${x.id}`, to: hover.key, type: "feeds" }); }
      for (const o of occupants) if (o.replaces.includes(hover.suitor.id)) { keys.add(`o${o.id}`); lines.push({ from: `o${o.id}`, to: hover.key, type: "replaces" }); }
    } else if (hover.occupant) {
      for (const sid of hover.occupant.replaces) { keys.add(`s${sid}`); lines.push({ from: hover.key, to: `s${sid}`, type: "replaces" }); }
    }
    return { keys, lines };
  }, [hover, suitors, occupants]);

  const { w, h } = size;
  const rc = layout?.rc ?? 90;
  const idText = identity.text?.trim();
  const fs = idText ? clamp(Math.sqrt((rc * rc * 1.9) / Math.max(idText.length, 12)), 11, 22) : 14;
  const halo = `0 0 0 ${8 + light * 26}px rgba(143, 211, 106, ${0.18 + light * 0.22}), 0 0 ${36 + light * 70}px rgba(143, 211, 106, ${0.3 + light * 0.4}), 0 10px 30px rgba(40, 80, 30, 0.12)`;
  const hp = hover ? pos.current.get(hover.key) : null;

  return (
    <div className="orbit" ref={wrap}>
      {layout && (
        <svg className="rings" viewBox={`0 0 ${w} ${h}`} aria-hidden>
          {layout.rings.map((r, i) => layout.used[i] && (
            <ellipse key={i} cx={w / 2} cy={h / 2} rx={r.rx} ry={r.ry} fill="none"
              stroke={i === 0 ? "#f2d77a" : "#d9e0ef"} strokeWidth={1.5} strokeDasharray={i === 0 ? "2 6" : "4 7"} />
          ))}
          {related?.lines.map((l, i) => {
            const a = pos.current.get(l.from), b = pos.current.get(l.to);
            if (!a || !b) return null;
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={l.type === "feeds" ? "#f08a4b" : "#e0b21c"} strokeWidth={2}
                strokeDasharray={l.type === "replaces" ? "5 5" : undefined} strokeOpacity={0.75} />
            );
          })}
        </svg>
      )}

      {/* the centre: who I am */}
      <button type="button" className="identity" onClick={() => setEditing(true)}
        style={{ width: rc * 2, height: rc * 2, transform: "translate(-50%, -50%)", boxShadow: halo }}
        aria-label="Edit who I am">
        <span className="who">Who I am</span>
        {idText ? (
          <>
            <span className="text" style={{ fontSize: fs }}>{idText}</span>
            {identity.reference && <span className="ref">{identity.reference}</span>}
          </>
        ) : (
          <span className="prompt" style={{ fontSize: Math.max(12, rc / 7) }}>Tap to write who you are in Christ</span>
        )}
      </button>

      {layout?.items.map((it) => {
        const st = it.suitor ? kindStyle(it.suitor.kind) : HOUSEHOLD;
        const dim = related && !related.keys.has(it.key);
        const cls = ["orb", it.suitor?.status === "evicting" && "evicting", (it.suitor?.recent ?? 0) > 0 && "recent", dim && "dim"]
          .filter(Boolean).join(" ");
        const href = it.suitor ? `/suitors/${it.suitor.id}` : `/household#o${it.occupant!.id}`;
        const showLabel = it.suitor ? true : it.r >= 22;
        return (
          <Link key={it.key} href={href} className={cls}
            ref={(el) => { if (el) els.current.set(it.key, el); else els.current.delete(it.key); }}
            onMouseEnter={() => setHover(it)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(it)} onBlur={() => setHover(null)}
            aria-label={it.suitor?.name ?? it.occupant?.name}
            style={{
              width: it.r * 2, height: it.r * 2, background: st.bg, color: st.fg,
              transform: "translate(-999px, -999px)",
              boxShadow: it.occupant ? `0 0 ${6 + light * 18}px rgba(242, 194, 48, ${0.25 + light * 0.4})` : undefined,
            }}>
            {showLabel && (
              <span style={{ fontSize: clamp(it.r * 0.27, 9, 15), maxWidth: it.r * 1.6 }}>
                {it.suitor ? shortName(it.suitor.name) : it.occupant!.name.split(" ").slice(0, 2).join(" ")}
              </span>
            )}
          </Link>
        );
      })}

      {hover && hp && (
        <div className="orbit-tip" style={{
          left: hp.x + hover.r + 290 < w ? hp.x + hover.r + 10 : clamp(hp.x - hover.r - 280, 8, w - 280),
          top: clamp(hp.y - 24, 8, h - 120),
        }}>
          {hover.suitor ? (
            <>
              <strong>{hover.suitor.name}</strong>
              <span className="muted">{kindLabel(hover.suitor.kind)}{hover.suitor.status === "evicting" ? " · being evicted" : ""}{hover.suitor.root ? " · first domino" : ""}</span>
              {hover.suitor.lie && <div style={{ marginTop: 6 }}>&ldquo;{hover.suitor.lie}&rdquo;</div>}
            </>
          ) : hover.occupant && (
            <>
              <strong>{hover.occupant.name}</strong>
              <span className="muted">
                {hover.occupant.reference ?? (hover.occupant.kind === "practice" ? `Kept ${hover.occupant.kept}× this week` : "Truth")}
              </span>
            </>
          )}
        </div>
      )}

      {editing && (
        <form className="identity-editor" action={async (fd) => { await updateIdentity(fd); setEditing(false); }}>
          <h3>Who I am</h3>
          <p className="muted" style={{ fontSize: "0.88rem" }}>
            After twenty years away, Odysseus came home in disguise. Argus, his old dog, still knew him. Write what stays true about you no matter what&rsquo;s orbiting.
          </p>
          <div className="field">
            <textarea name="identity" defaultValue={identity.text ?? ""} rows={3} autoFocus maxLength={220}
              placeholder="e.g. I am a son of God: chosen, forgiven, and not condemned." />
          </div>
          <div className="field">
            <input name="reference" defaultValue={identity.reference ?? ""} placeholder="Scripture it stands on (optional), e.g. 2 Corinthians 5:17" />
          </div>
          <div className="row">
            <button className="primary">Save</button>
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
