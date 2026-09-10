"use client";

/**
 * RELAY — the WINDOW TRACK.
 * The signature bar of the Live Lap screen: a relay track that fills as the
 * market window runs, with a baton gliding along it toward settlement.
 * Phase gates (SCAN / ORDER / CLOSING / ORACLE) are etched above the lane.
 */

import { BatonGlyph } from "@/components/relay/identity/identity";
import { PHASE_DURATIONS, WINDOW_SIM_MS } from "@/lib/relay/engine/phaseTimings";
import { cn } from "@/lib/utils";

/* where each gate sits on the window timeline (fraction 0..1) */
const ENTRY_MS =
  PHASE_DURATIONS.SCAN + PHASE_DURATIONS.ARMED; /* ORDER begins here */
const CLOSING_MS =
  ENTRY_MS + PHASE_DURATIONS.ORDER + PHASE_DURATIONS.FILL + PHASE_DURATIONS.HOLD;

const GATES: { key: string; at: number }[] = [
  { key: "SCAN", at: 0 },
  { key: "ORDER", at: ENTRY_MS / WINDOW_SIM_MS },
  { key: "CLOSING", at: CLOSING_MS / WINDOW_SIM_MS },
  { key: "ORACLE", at: 1 },
];

export function WindowTrack({
  progress,
  className,
}: {
  progress: number; // 0..1 of the window elapsed
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;

  return (
    <div className={cn("relative", className)}>
      {/* gate labels above the lane */}
      {GATES.map((g) => (
        <span
          key={g.key}
          className="absolute -top-4 mlabel text-foam/60 whitespace-nowrap"
          style={{
            left: `${g.at * 100}%`,
            transform:
              g.at === 0
                ? "none"
                : g.at === 1
                  ? "translateX(-100%)"
                  : "translateX(-50%)",
          }}
          aria-hidden
        >
          {g.key}
        </span>
      ))}

      {/* the lane */}
      <div
        className="relative h-2.5 rounded-full bg-panel2 border border-lined"
        role="progressbar"
        aria-label="Market window progress"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* lime fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-lime"
          style={{ width: `${pct}%`, transition: "width 300ms linear" }}
        />
        {/* 48 track ticks */}
        <div className="absolute inset-0 flex justify-between items-center px-1" aria-hidden>
          {Array.from({ length: 48 }, (_, i) => (
            <span key={i} className="w-px h-2 bg-foam/20" />
          ))}
        </div>
        {/* the baton */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
          style={{ left: `${pct}%`, transition: "left 300ms linear" }}
          aria-hidden
        >
          <BatonGlyph className="w-10 h-auto" glow />
        </div>
      </div>
    </div>
  );
}
