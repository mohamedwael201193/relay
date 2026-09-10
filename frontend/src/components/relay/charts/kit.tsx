"use client";

/**
 * RELAY — chart kit.
 * Shared infrastructure for the hand-built broadcast charts: container
 * measurement, nearest-point hover state, the mono tooltip readout card,
 * the panel frame (label + legend + scroll reveal) and the designed
 * empty state. Pure SVG + framer — no chart libraries.
 */

import { useEffect, useRef, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Panel } from "../core/primitives";

/* ── broadcast palette (exact tokens) ─────────────────────────── */

export const CH = {
  lime: "#aae83c",
  ember: "#f0512a",
  flame: "#ffb224",
  foam: "#b3a98f",
  cream: "#f3efdd",
  lined: "#3a3320",
  panel: "#1e1a10",
  panel2: "#292314",
  graphite: "#14110a",
  oracle: "#e8d5a8",
} as const;

export type Tone = "lime" | "ember" | "flame" | "foam" | "cream";

const TONE_TEXT: Record<Tone, string> = {
  lime: "text-lime",
  ember: "text-ember",
  flame: "text-flame",
  foam: "text-foam",
  cream: "text-cream",
};

export const TONE_HEX: Record<Tone, string> = {
  lime: CH.lime,
  ember: CH.ember,
  flame: CH.flame,
  foam: CH.foam,
  cream: CH.cream,
};

/* ── measurement ──────────────────────────────────────────────── */

/** ResizeObserver width of a full-width block container. */
export function useChartWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setW(Math.max(0, Math.round(cr.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Sanitized unique id for SVG defs (gradients). */
export function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

/* ── hover helpers ────────────────────────────────────────────── */

/** Local x (px) of a pointer event inside the given element. */
export function localX(e: React.PointerEvent<Element>): number {
  return e.clientX - e.currentTarget.getBoundingClientRect().left;
}

export function localY(e: React.PointerEvent<Element>): number {
  return e.clientY - e.currentTarget.getBoundingClientRect().top;
}

/** Index of the nearest x in xs. */
export function nearestIndex(px: number, xs: number[]): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const d = Math.abs(xs[i] - px);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/* ── tick math ────────────────────────────────────────────────── */

/** "Nice" axis ticks covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const step0 = span / Math.max(1, count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step =
    (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 1e-6; v = +(v + step).toFixed(6)) out.push(v);
  return out.length ? out : [min];
}

/** Compact $ tick label. */
export function moneyTick(v: number): string {
  if (Math.abs(v) >= 10_000) return `$${Math.round(v / 1000)}k`;
  const dec = Math.abs(v) < 10 && v % 1 !== 0 ? 1 : 0;
  return `$${v.toFixed(dec)}`;
}

/* ── the mono readout card ────────────────────────────────────── */

export interface TipLine {
  k: string;
  v: ReactNode;
  tone?: Tone;
}

/**
 * The custom chart tooltip: a bordered mono card positioned above (or
 * below, flipped) a point, clamped inside the chart viewport.
 */
export function ChartTip({
  x,
  y,
  viewW,
  flip = false,
  title,
  lines,
}: {
  x: number;
  y: number;
  viewW: number;
  flip?: boolean;
  title: ReactNode;
  lines: TipLine[];
}) {
  const cardW = 184;
  const margin = cardW / 2 + 4;
  const left = Math.min(Math.max(x, margin), Math.max(viewW - margin, margin));
  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{
        left,
        top: flip ? y + 16 : y - 10,
        transform: flip ? "translate(-50%, 0)" : "translate(-50%, -100%)",
      }}
      role="status"
    >
      <div className="w-[184px] rounded-lg border-2 border-lined bg-graphite/95 px-3 py-2 hardshadow-d">
        <div className="mlabel text-flame">{title}</div>
        <div className="mt-1.5 space-y-1">
          {lines.map((l) => (
            <div key={l.k} className="flex items-baseline justify-between gap-3">
              <span className="mlabel text-foam/70">{l.k}</span>
              <span className={cn("data text-xs font-semibold", TONE_TEXT[l.tone ?? "cream"])}>
                {l.v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── legend ───────────────────────────────────────────────────── */

export function LegendSwatch({
  color,
  label,
  shape = "square",
}: {
  color: string;
  label: string;
  shape?: "square" | "line" | "dot" | "ring";
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {shape === "square" && (
        <span className="h-2.5 w-3 rounded-[3px]" style={{ background: color }} aria-hidden />
      )}
      {shape === "line" && (
        <span className="h-0.5 w-3.5 rounded-full" style={{ background: color }} aria-hidden />
      )}
      {shape === "dot" && (
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
      )}
      {shape === "ring" && (
        <span
          className="h-2.5 w-2.5 rounded-[3px]"
          style={{ background: "transparent", boxShadow: `inset 0 0 0 2px ${color}` }}
          aria-hidden
        />
      )}
      <span className="mlabel text-foam/70">{label}</span>
    </span>
  );
}

/* ── empty state ──────────────────────────────────────────────── */

/** Designed empty: a ghosted dashed chart waiting for settled laps. */
export function ChartEmpty({
  height = 180,
  note = "waiting for the tape",
}: {
  height?: number;
  note?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 px-5 py-6"
      style={{ minHeight: height }}
    >
      <svg width="164" height="70" viewBox="0 0 164 70" aria-hidden className="opacity-80">
        <line x1="4" y1="60" x2="160" y2="60" stroke={CH.lined} strokeWidth="2" strokeDasharray="6 6" />
        {[26, 54, 82, 110, 138].map((x, i) => (
          <rect
            key={x}
            x={x - 7}
            y={60 - (12 + i * 9)}
            width="14"
            height={12 + i * 9}
            rx="2"
            fill="none"
            stroke={CH.lined}
            strokeWidth="1.6"
            strokeDasharray="4 4"
          />
        ))}
        <path
          d="M8 42 C 30 20, 58 46, 86 28 S 126 16, 156 10"
          fill="none"
          stroke={CH.foam}
          strokeWidth="1.6"
          strokeDasharray="3 6"
          opacity="0.65"
        />
      </svg>
      <div className="text-center">
        <div className="serif-accent text-lg leading-none text-foam">Waiting for the tape.</div>
        <div className="data mt-1.5 text-[0.65rem] text-foam/60">{note}</div>
      </div>
    </div>
  );
}

/* ── panel frame + reveal ─────────────────────────────────────── */

export function ChartPanel({
  label,
  legend,
  className,
  panelClassName,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  label: string;
  legend?: ReactNode;
  panelClassName?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-24px" }}
      transition={{ duration: 0.38, ease: [0.22, 0.61, 0.36, 1] }}
      className={cn("h-full", className)}
    >
      <Panel label={label} className={cn("h-full", panelClassName)} {...rest}>
        {children}
        {legend ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t-2 border-lined/70 px-5 py-3">
            {legend}
          </div>
        ) : (
          <div className="pb-2" />
        )}
      </Panel>
    </motion.div>
  );
}

/* ── a11y ─────────────────────────────────────────────────────── */

/** Screen-reader text version of a chart (paired with role="img"). */
export function ChartSummary({ text }: { text: string }) {
  return <p className="sr-only">{text}</p>;
}
