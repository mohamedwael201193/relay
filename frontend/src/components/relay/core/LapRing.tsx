"use client";

/**
 * RELAY — the LAP RING.
 * The signature component: a relay track that fills as the market window
 * runs, with an orbiting baton carrying the position toward settlement.
 */

import { cn } from "@/lib/utils";
import type { LapPhase, Side } from "@/lib/relay/types";
import { AssetIcon } from "../identity/identity";

const R = 118;
const C = 2 * Math.PI * R;

function phaseTone(phase: LapPhase): { arc: string; label: string; pulse: boolean } {
  switch (phase) {
    case "SCAN":
      return { arc: "#b3a98f", label: "SCANNING", pulse: false };
    case "ARMED":
      return { arc: "#ffb224", label: "ARMING", pulse: true };
    case "ORDER":
      return { arc: "#ffb224", label: "ORDER LIVE", pulse: true };
    case "FILL":
      return { arc: "#aae83c", label: "FILLED", pulse: true };
    case "HOLD":
      return { arc: "#aae83c", label: "HOLDING", pulse: false };
    case "CLOSING":
      return { arc: "#f0512a", label: "CLOSING", pulse: true };
    case "ORACLE":
      return { arc: "#e8d5a8", label: "ORACLE", pulse: true };
    case "RESULT":
      return { arc: "#ffb224", label: "RESULT", pulse: true };
    case "CLAIM":
      return { arc: "#aae83c", label: "CLAIMED", pulse: false };
    case "REARM":
      return { arc: "#aae83c", label: "BATON PASS", pulse: true };
  }
}

export function LapRing({
  progress,
  countdownLabel,
  phase,
  asset,
  side,
  size = 300,
  dark = true,
  className,
  compact = false,
  centerLabel,
}: {
  progress: number; // 0..1 elapsed
  countdownLabel: string;
  phase: LapPhase;
  asset: string;
  side: Side | null;
  size?: number;
  dark?: boolean;
  className?: string;
  compact?: boolean;
  centerLabel?: string;
}) {
  const p = Math.min(1, Math.max(0, progress));
  const tone = phaseTone(phase);
  const angle = p * 360 - 90;
  const track = dark ? "#3a3320" : "#d9d2bb";
  const inkText = dark ? "#f3efdd" : "#1a1610";
  const sub = dark ? "#b3a98f" : "#6b6250";

  return (
    <div
      className={cn("relative select-none", className)}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`Window ${countdownLabel} remaining, phase ${tone.label}`}
    >
      <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full">
        <defs>
          <filter id="batonGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* lane ticks */}
        <g opacity={dark ? 0.35 : 0.5}>
          {Array.from({ length: 48 }, (_, i) => {
            const a = (i / 48) * Math.PI * 2;
            const x1 = 150 + Math.cos(a) * 138;
            const y1 = 150 + Math.sin(a) * 138;
            const x2 = 150 + Math.cos(a) * 144;
            const y2 = 150 + Math.sin(a) * 144;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={dark ? "#b3a98f" : "#6b6250"}
                strokeWidth="2"
              />
            );
          })}
        </g>

        {/* base track */}
        <circle
          cx="150"
          cy="150"
          r={R}
          fill="none"
          stroke={track}
          strokeWidth={compact ? 8 : 11}
        />

        {/* progress arc */}
        <circle
          cx="150"
          cy="150"
          r={R}
          fill="none"
          stroke={tone.arc}
          strokeWidth={compact ? 8 : 11}
          strokeLinecap="round"
          strokeDasharray={`${C * p} ${C}`}
          transform="rotate(-90 150 150)"
          style={{ transition: "stroke-dasharray 260ms linear, stroke 400ms" }}
        />

        {/* comet trail behind the baton */}
        {p > 0.02 && (
          <circle
            cx="150"
            cy="150"
            r={R}
            fill="none"
            stroke={tone.arc}
            strokeWidth={compact ? 8 : 11}
            strokeLinecap="round"
            opacity="0.28"
            strokeDasharray={`${C * Math.min(0.12, p)} ${C}`}
            strokeDashoffset={`${-C * Math.max(0, p - 0.12)}`}
            transform="rotate(-90 150 150)"
            style={{ transition: "stroke-dashoffset 260ms linear, stroke-dasharray 260ms linear" }}
          />
        )}

        {/* orbiting baton */}
        <g
          transform={`rotate(${angle} 150 150)`}
          style={{ transition: "transform 260ms linear" }}
        >
          <g transform={`translate(150 ${150 - R})`}>
            <g filter="url(#batonGlow)">
              <g transform="rotate(90)">
                <rect
                  x={compact ? -11 : -13}
                  y={compact ? -4.5 : -5.5}
                  width={compact ? 22 : 26}
                  height={compact ? 9 : 11}
                  rx={compact ? 4.5 : 5.5}
                  fill={tone.arc}
                  stroke={dark ? "#14110a" : "#1a1610"}
                  strokeWidth="2.4"
                />
                <circle cx={compact ? -4.5 : -5.5} cy="0" r="1.9" fill={dark ? "#14110a" : "#1a1610"} />
                <circle cx={compact ? 4.5 : 5.5} cy="0" r="1.9" fill="#ffb224" />
              </g>
            </g>
          </g>
        </g>

        {/* oracle arrival flash */}
        {tone.pulse && (
          <circle
            cx="150"
            cy="150"
            r={R}
            fill="none"
            stroke={tone.arc}
            strokeWidth="2"
            className="blink"
            opacity="0.7"
          />
        )}
      </svg>

      {/* center */}
      <div className="absolute inset-0 grid place-items-center text-center">
        <div className={cn("flex flex-col items-center gap-1", compact && "gap-0")}>
          {compact ? (
            <>
              <span
                className={cn("data font-semibold leading-none", dark ? "text-cream" : "text-ink")}
                style={{ fontSize: size * 0.17 }}
              >
                {countdownLabel}
              </span>
              <span
                className="mlabel mt-1"
                style={{ color: tone.arc, fontSize: size * 0.052 }}
              >
                {tone.label}
              </span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <AssetIcon asset={asset} size={22} />
                <span className="mlabel" style={{ color: sub }}>
                  {centerLabel ?? `${asset} · 15M`}
                </span>
              </div>
              <span
                className="data font-semibold leading-none tabular-nums mt-1"
                style={{ color: inkText, fontSize: size * 0.185, letterSpacing: "-0.02em" }}
              >
                {countdownLabel}
              </span>
              <span className="mlabel mt-1.5" style={{ color: tone.arc }}>
                {tone.label}
              </span>
              {side && (
                <span
                  className="mt-2 data text-[0.8rem] font-semibold px-2.5 py-0.5 rounded-md border-2"
                  style={{
                    color: side === "UP" ? "#14110a" : "#f3efdd",
                    background: side === "UP" ? "#aae83c" : "#f0512a",
                    borderColor: "#14110a",
                  }}
                >
                  {side === "UP" ? "▲ UP" : "▼ DOWN"}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── probability split gauge (UP vs DOWN book pressure) ─────── */

export function ProbSplit({
  probUp,
  dark = true,
  className,
  height = 10,
}: {
  probUp: number;
  dark?: boolean;
  className?: string;
  height?: number;
}) {
  const up = Math.round(probUp * 100);
  return (
    <div className={cn("w-full overflow-hidden rounded-full border-2", className)}
      style={{ height, borderColor: dark ? "#3a3320" : "#1a1610", background: "#f0512a" }}
      role="img"
      aria-label={`Up probability ${up}%`}
    >
      <div
        className="h-full"
        style={{
          width: `${up}%`,
          background: "#aae83c",
          transition: "width 400ms cubic-bezier(0.22, 0.61, 0.36, 1)",
        }}
      />
    </div>
  );
}
