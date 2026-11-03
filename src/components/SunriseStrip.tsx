"use client";

import { useEffect, useState } from "react";
import { STAGES } from "@/lib/stage";

/** Where you are on the way from night to day. Tap a stage to preview how the house will look. */
export function SunriseStrip({ stage, light }: { stage: number; light: number }) {
  const [preview, setPreview] = useState<number | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.stage = String(preview ?? stage);
    return () => { root.dataset.stage = String(stage); };
  }, [preview, stage]);

  const next = STAGES[stage + 1];
  const shown = STAGES[preview ?? stage];

  return (
    <div>
      <div className="spread">
        <small style={{ fontWeight: 600 }}>
          {preview === null ? <>{STAGES[stage].name}: {STAGES[stage].line}</> : <>Previewing {shown.name}</>}
        </small>
        {preview !== null ? (
          <button type="button" className="ghost" onClick={() => setPreview(null)}>Back to now</button>
        ) : next ? (
          <small className="faint">{Math.max(1, Math.round((next.from - light) * 100))}% more light until {next.name.toLowerCase()}</small>
        ) : null}
      </div>
      <div className="stages" role="group" aria-label="Stages from night to day">
        {STAGES.map((s, i) => (
          <button key={s.name} type="button"
            className={["stage", i <= stage && "reached", i === stage && "current", preview === i && "previewing"].filter(Boolean).join(" ")}
            style={{ background: s.swatch, color: s.fg }}
            onClick={() => setPreview(i === stage ? null : i)}
            aria-pressed={preview === i}
            title={i === stage ? `${s.name}: you are here` : `Preview ${s.name}`}>
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
