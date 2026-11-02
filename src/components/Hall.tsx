"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY,
  type Simulation, type SimulationLinkDatum, type SimulationNodeDatum,
} from "d3-force";

export type HallNode = {
  id: string;
  group: "suitor" | "occupant";
  label: string;
  detail?: string;
  color: string;
  r: number;
  href: string;
  status?: string;
  root?: boolean;
  recent?: number; // encounters in the last few days → it glows
  labeled?: boolean; // always show the name (otherwise on hover)
};

export type HallLink = { source: string; target: string; type: "feeds" | "replaces" };

type N = HallNode & SimulationNodeDatum;
type L = SimulationLinkDatum<N> & { type: HallLink["type"] };

const short = (s: string, n = 28) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function Hall({ nodes, links, light }: { nodes: HallNode[]; links: HallLink[]; light: number }) {
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const sim = useRef<Simulation<N, L> | null>(null);
  const nodesRef = useRef<N[]>([]);
  const linksRef = useRef<L[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [, setFrame] = useState(0);
  const [hover, setHover] = useState<N | null>(null);

  // Track container size
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build / rebuild the simulation
  useEffect(() => {
    const { w, h } = size;
    if (!w || !h) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scale = Math.min(1, Math.max(0.6, Math.min(w, h) / 560));

    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    const ns: N[] = nodes.map((n) => {
      const p = prev.get(n.id);
      return {
        ...n,
        r: n.r * scale,
        x: p?.x ?? w / 2 + (Math.random() - 0.5) * w * 0.5,
        y: p?.y ?? (n.group === "occupant" ? h * 0.15 : h * 0.6) + (Math.random() - 0.5) * 60,
        vx: p?.vx, vy: p?.vy,
      };
    });
    const ids = new Set(ns.map((n) => n.id));
    const ls: L[] = links
      .filter((l) => ids.has(l.source) && ids.has(l.target))
      .map((l) => ({ ...l }));
    nodesRef.current = ns;
    linksRef.current = ls;

    // Suitors settle in the bottom of the bucket; those being evicted drift toward the door (right).
    // The household (gold) gathers above, hovering near what it replaces.
    const s = forceSimulation<N, L>(ns)
      .force("charge", forceManyBody<N>().strength((d) => (d.group === "suitor" ? -260 : -30) * scale).distanceMax(w * 0.6))
      .force("collide", forceCollide<N>().radius((d) => d.r + (d.group === "suitor" ? 16 : 5)).strength(0.9))
      .force("link", forceLink<N, L>(ls).id((d) => d.id)
        .distance((l) => (l.type === "feeds" ? 120 : 110) * scale)
        .strength((l) => (l.type === "feeds" ? 0.03 : 0.04)))
      .force("x", forceX<N>((d) => (d.status === "evicting" ? w * 0.78 : w / 2))
        .strength((d) => (d.status === "evicting" ? 0.05 : 0.012)))
      .force("y", forceY<N>((d) => (d.group === "occupant" ? h * 0.12 : d.root ? h * 0.72 : h * 0.6))
        .strength((d) => (d.group === "occupant" ? 0.12 : 0.03)))
      .alphaDecay(0.02)
      .velocityDecay(0.35);

    if (!reduce) s.alphaTarget(0.012);

    s.on("tick", () => {
      for (const n of ns) {
        if (!reduce) {
          // a slow, breathing drift
          n.vx = (n.vx ?? 0) + (Math.random() - 0.5) * 0.12;
          n.vy = (n.vy ?? 0) + (Math.random() - 0.5) * 0.12;
        }
        n.x = Math.max(n.r + 4, Math.min(w - n.r - 4, n.x ?? 0));
        n.y = Math.max(n.r + 4, Math.min(h - n.r - 18, n.y ?? 0));
      }
      setFrame((f) => (f + 1) % 1_000_000);
    });
    sim.current = s;
    return () => { s.stop(); };
  }, [nodes, links, size]);

  const { w, h } = size;
  const glow = 0.15 + light * 0.85;

  return (
    <div className="hall" ref={wrap} onMouseLeave={() => setHover(null)}>
      {w > 0 && (
        <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Everything occupying the house">
          <defs>
            <filter id="goldGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation={6 + light * 10} result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="emberGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {nodesRef.current.map((n) => (
              <radialGradient key={n.id} id={`g-${n.id}`} cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor={n.group === "occupant" ? "#fff6dc" : n.color} stopOpacity={n.group === "occupant" ? 1 : 0.95} />
                <stop offset="55%" stopColor={n.color} stopOpacity={n.group === "occupant" ? 0.85 : 0.55} />
                <stop offset="100%" stopColor={n.color} stopOpacity={n.group === "occupant" ? 0.35 : 0.18} />
              </radialGradient>
            ))}
          </defs>

          {/* the door */}
          <g opacity={0.5}>
            <rect x={w - 14} y={h * 0.32} width={6} height={h * 0.4} rx={3} fill="url(#doorFade)" />
            <linearGradient id="doorFade" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#f5c451" stopOpacity="0" />
              <stop offset="0.5" stopColor="#f5c451" stopOpacity={0.25 + light * 0.6} />
              <stop offset="1" stopColor="#f5c451" stopOpacity="0" />
            </linearGradient>
          </g>

          {linksRef.current.map((l, i) => {
            const s = l.source as N, t = l.target as N;
            if (s.x == null || t.x == null) return null;
            const active = hover && (hover.id === s.id || hover.id === t.id);
            return (
              <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={l.type === "feeds" ? "#d9622b" : "#f5c451"}
                strokeOpacity={active ? 0.75 : l.type === "feeds" ? 0.16 : 0.12 + light * 0.15}
                strokeWidth={active ? 1.8 : 1}
                strokeDasharray={l.type === "replaces" ? "3 5" : undefined} />
            );
          })}

          {nodesRef.current.map((n) => {
            const dim = hover && hover.id !== n.id &&
              !linksRef.current.some((l) => (l.source as N).id === hover.id && (l.target as N).id === n.id
                || (l.target as N).id === hover.id && (l.source as N).id === n.id);
            return (
              <g key={n.id} className="orb" transform={`translate(${n.x},${n.y})`}
                opacity={dim ? 0.3 : 1}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onBlur={() => setHover(null)}
                onClick={() => router.push(n.href)}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") router.push(n.href); }}
                role="link" aria-label={n.label}>
                {n.group === "occupant" ? (
                  <circle r={n.r} fill={`url(#g-${n.id})`} filter="url(#goldGlow)" opacity={glow} />
                ) : (
                  <>
                    {(n.recent ?? 0) > 0 && (
                      <circle r={n.r + 6} fill={n.color} opacity={0.18} filter="url(#emberGlow)">
                        <animate attributeName="r" values={`${n.r + 3};${n.r + 10};${n.r + 3}`} dur="3.2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle r={n.r} fill={`url(#g-${n.id})`} stroke={n.color} strokeOpacity={0.6} />
                    {n.status === "evicting" && (
                      <circle r={n.r + 4} fill="none" stroke="#f5c451" strokeOpacity={0.7} strokeDasharray="4 4">
                        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="18s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {n.root && <circle r={n.r * 0.28} fill="#0b0a09" opacity={0.5} />}
                  </>
                )}
                {(n.labeled || hover?.id === n.id) && (
                  <text className="orb-label" y={n.r + 13}
                    x={(n.x ?? 0) < 90 ? -n.r : (n.x ?? 0) > w - 90 ? n.r : 0}
                    textAnchor={(n.x ?? 0) < 90 ? "start" : (n.x ?? 0) > w - 90 ? "end" : "middle"}>
                    {short(n.label, w < 500 ? 22 : 28)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover && hover.x != null && (
        <div className="hall-tip" style={{
          left: Math.min(Math.max(8, hover.x + hover.r + 10), w - 268),
          top: Math.max(8, (hover.y ?? 0) - 20),
        }}>
          <strong>{hover.label}</strong>
          {hover.detail && <div className="muted" style={{ marginTop: 4 }}>{hover.detail}</div>}
        </div>
      )}
    </div>
  );
}
