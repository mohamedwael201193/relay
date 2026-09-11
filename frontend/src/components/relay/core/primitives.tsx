"use client";

/** RELAY — core UI primitives shared by every screen. */

import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import type { LapPhase } from "@/lib/relay/types";
import { useRelay } from "@/lib/relay/engine/store";
import { useToast } from "@/hooks/use-toast";

/* ── panel ──────────────────────────────────────────────────── */

export function Panel({
  className,
  dark = true,
  children,
  label,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { dark?: boolean; label?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2",
        dark
          ? "bg-panel border-lined text-cream"
          : "bg-cardp border-linen text-ink",
        className
      )}
      {...rest}
    >
      {label && (
        <div
          className={cn(
            "mlabel px-5 pt-4",
            dark ? "text-foam" : "text-ink2"
          )}
        >
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── stat tile ──────────────────────────────────────────────── */

export function StatTile({
  label,
  value,
  sub,
  tone = "neutral",
  dark = true,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "neutral" | "up" | "down" | "flame" | "cream";
  dark?: boolean;
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: dark ? "text-cream" : "text-ink",
    up: "text-lime",
    down: "text-ember",
    flame: "text-flame",
    cream: dark ? "text-cream" : "text-ink",
  };
  return (
    <div
      className={cn(
        "rounded-xl border-2 px-4 py-3",
        dark ? "bg-panel2/60 border-lined" : "bg-linen2 border-linen",
        className
      )}
    >
      <div className={cn("mlabel", dark ? "text-foam" : "text-ink2")}>{label}</div>
      <div className={cn("data font-semibold text-xl mt-1.5 leading-none", tones[tone])}>
        {value}
      </div>
      {sub && (
        <div className={cn("data text-[0.7rem] mt-1.5", dark ? "text-foam/80" : "text-ink2")}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ── live dot ───────────────────────────────────────────────── */

export function LiveDot({ label, tone = "lime" }: { label?: string; tone?: "lime" | "ember" | "flame" | "cream" }) {
  const color =
    tone === "lime" ? "#aae83c" : tone === "ember" ? "#f0512a" : tone === "flame" ? "#ffb224" : "#f3efdd";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative grid place-items-center w-2.5 h-2.5">
        <span className="absolute inset-0 rounded-full pulse-ring" style={{ background: color }} />
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      </span>
      {label && <span className="mlabel" style={{ color }}>{label}</span>}
    </span>
  );
}

/* ── sparkline ──────────────────────────────────────────────── */

export function Sparkline({
  values,
  width = 120,
  height = 34,
  dark = true,
  className,
  strokeWidth = 2,
  showArea = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  dark?: boolean;
  className?: string;
  strokeWidth?: number;
  showArea?: boolean;
}) {
  if (!values || values.length < 2) {
    return (
      <svg width={width} height={height} className={className} aria-hidden>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={dark ? "#3a3320" : "#d9d2bb"} strokeDasharray="3 4" />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = height - 4 - ((v - min) / span) * (height - 8);
    return [x, y] as const;
  });
  const rising = values[values.length - 1] >= values[0];
  const stroke = rising ? "#aae83c" : "#f0512a";
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)} ${height} L${pts[0][0].toFixed(1)} ${height} Z`;
  const id = `sg-${Math.round(pts[0][1])}-${values.length}-${Math.round(pts[pts.length - 1][1])}`;
  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {showArea && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={stroke} stopOpacity="0.25" />
              <stop offset="1" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${id})`} />
        </>
      )}
      <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={stroke} />
    </svg>
  );
}

/* ── phase stepper ──────────────────────────────────────────── */

const PHASES: { key: LapPhase; short: string }[] = [
  { key: "SCAN", short: "SCAN" },
  { key: "ARMED", short: "ARM" },
  { key: "ORDER", short: "ORDER" },
  { key: "FILL", short: "FILL" },
  { key: "HOLD", short: "HOLD" },
  { key: "CLOSING", short: "CLOSE" },
  { key: "ORACLE", short: "ORACLE" },
  { key: "RESULT", short: "RESULT" },
  { key: "CLAIM", short: "CLAIM" },
  { key: "REARM", short: "RE-ARM" },
];

export function PhaseStepper({
  phase,
  history,
  dark = true,
}: {
  phase: LapPhase;
  history?: LapPhase[];
  dark?: boolean;
}) {
  const activeIdx = PHASES.findIndex((p) => p.key === phase);
  const reached = new Set(
    history && history.length ? history : PHASES.slice(0, Math.max(0, activeIdx) + 1).map((p) => p.key),
  );
  return (
    <ol className="flex items-center gap-1 overflow-x-auto scroll-thin pb-1" aria-label="Lap phase">
      {PHASES.map((p, i) => {
        const active = i === activeIdx;
        const done = !active && (reached.has(p.key) || i < activeIdx);
        return (
          <li key={p.key} className="flex items-center gap-1 shrink-0">
            <span
              className={cn(
                "mlabel px-2 py-1 rounded-md border whitespace-nowrap",
                active
                  ? "bg-lime text-graphite border-lime font-semibold"
                  : done
                    ? dark
                      ? "text-lime/80 border-limedeep/50"
                      : "text-limedeep border-limedeep/40"
                    : dark
                      ? "text-foam/40 border-lined"
                      : "text-ink3 border-linen"
              )}
              aria-current={active ? "step" : undefined}
            >
              {p.short}
            </span>
            {i < PHASES.length - 1 && (
              <span
                className={cn("w-3 h-px", done || active ? "bg-lime/50" : dark ? "bg-lined" : "bg-linen")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ── live price line ────────────────────────────────────────── */

export function PriceLine({
  points,
  open,
  entry,
  dark = true,
  height = 140,
  className,
  showLabels = true,
}: {
  points: { t: number; p: number }[];
  open: number;
  entry?: number | null;
  dark?: boolean;
  height?: number;
  className?: string;
  showLabels?: boolean;
}) {
  const W = 600;
  const H = height;
  if (points.length < 2) {
    return (
      <div
        className={cn("grid place-items-center rounded-xl border-2", dark ? "border-lined" : "border-linen", className)}
        style={{ height: H }}
      >
        <span className="mlabel" style={{ color: dark ? "#b3a98f" : "#6b6250" }}>
          AWAITING PRICE FEED…
        </span>
      </div>
    );
  }
  const prices = points.map((p) => p.p);
  const min = Math.min(...prices, open);
  const max = Math.max(...prices, open);
  const span = max - min || 1;
  const y = (v: number) => H - 12 - ((v - min) / span) * (H - 24);
  const x = (i: number) => (i / (points.length - 1)) * (W - 8) + 4;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.p).toFixed(1)}`).join(" ");
  const last = prices[prices.length - 1];
  const above = last >= open;
  const stroke = above ? "#aae83c" : "#f0512a";
  const area = `${d} L${x(points.length - 1).toFixed(1)} ${H} L4 ${H} Z`;
  const id = `pl-${Math.round(min)}-${Math.round(max)}-${points.length}`;
  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} role="img" aria-label={`Live price, currently ${last}`}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="1" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* open/strike line */}
        <line x1="0" x2={W} y1={y(open)} y2={y(open)} stroke={dark ? "#b3a98f" : "#6b6250"} strokeWidth="1.4" strokeDasharray="6 5" />
        {showLabels && (
          <text x="6" y={y(open) - 6} className="data" fontSize="10" fill={dark ? "#b3a98f" : "#6b6250"} fontFamily="var(--font-data)">
            OPEN {open.toLocaleString()}
          </text>
        )}
        {entry != null && (
          <g>
            <line x1="0" x2={W} y1={y(entry)} y2={y(entry)} stroke="#ffb224" strokeWidth="1.2" strokeDasharray="2 5" opacity="0.8" />
          </g>
        )}
        <path d={area} fill={`url(#${id})`} />
        <path d={d} fill="none" stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(points.length - 1)} cy={y(last)} r="4" fill={stroke} stroke="#14110a" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

/* ── market ticker strip ────────────────────────────────────── */

export function TickerStrip({ dark = false }: { dark?: boolean }) {
  const liveLap = useRelay((s) => s.liveLap);
  const calendar = useRelay((s) => s.calendar);
  const probUp = liveLap?.probUp ?? 0.5;
  const items = [
    liveLap && {
      asset: liveLap.market.asset,
      text: `${liveLap.market.asset} UP OR DOWN · 15M`,
      right: `${probUp > 0.5 ? "▲" : "▼"} ${(probUp * 100).toFixed(1)}¢`,
      up: probUp > 0.5,
      live: true,
    },
    ...calendar.map((w) => ({
      asset: w.asset,
      text: `${w.asset} UP OR DOWN · 15M`,
      right: "NEXT",
      up: true,
      live: false,
    })),
  ].filter(Boolean) as { asset: string; text: string; right: string; up: boolean; live: boolean }[];

  const doubled = [...items, ...items];
  return (
    <div
      className={cn(
        "relative overflow-hidden border-y-2 py-2",
        dark ? "border-lined bg-graphite" : "border-ink bg-paper2"
      )}
      aria-label="Live market windows"
    >
      <div className="marquee-track flex items-center gap-10 w-max px-4">
        {doubled.map((it, i) => (
          <span key={i} className="flex items-center gap-2.5 whitespace-nowrap">
            {it.live && (
              <span className="w-1.5 h-1.5 rounded-full bg-lime blink" aria-hidden />
            )}
            <span
              className="mlabel"
              style={{ color: dark ? "#f3efdd" : "#1a1610", opacity: it.live ? 1 : 0.55 }}
            >
              {it.text}
            </span>
            <span
              className="data text-[0.7rem] font-semibold"
              style={{ color: it.right === "NEXT" ? (dark ? "#b3a98f" : "#6b6250") : it.up ? "#6fa51e" : "#c23a15" }}
            >
              {it.right}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── toast bridge: engine notifications → toasts ───────────── */

export function RelayToasts() {
  const notifications = useRelay((s) => s.notifications);
  const resultOpen = useRelay((s) => s.resultOpen);
  const { toast } = useToast();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (seen.current === null) {
      // first run: swallow the seeded backlog silently
      seen.current = new Set(notifications.map((n) => n.id));
      return;
    }
    for (const n of notifications) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (n.kind === "FILL") continue; // fills live in the feed, not toasts
      if (resultOpen && ["WIN", "LOSS", "VOID", "CLAIM"].includes(n.kind)) continue; // overlay owns the moment
      toast({
        title: n.title,
        description: n.body,
        variant: n.kind === "LOSS" || n.kind === "VOID" ? "destructive" : "default",
      });
    }
  }, [notifications, toast, resultOpen]);

  return null;
}
