"use client";

/**
 * RELAY — settings screen shared controls.
 * Status chips, border-2 control buttons, policy chips and editor rows
 * shared by the control center's sections.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";

import type { RunnerStatus } from "@/lib/relay/types";
import { cn } from "@/lib/utils";

/* ── control button (2px border, 44px touch target) ─────────── */

export type Tone = "lime" | "limeOutline" | "flame" | "ember" | "outline";

const TONES: Record<Tone, string> = {
  lime: "border-lime text-lime hover:bg-lime hover:text-graphite",
  limeOutline: "border-lime/60 text-lime hover:border-lime hover:bg-lime/10",
  flame: "border-flame text-flame hover:bg-flame hover:text-graphite",
  ember: "border-ember text-ember hover:bg-ember hover:text-cream",
  outline: "border-lined text-foam hover:border-foam/60 hover:text-cream",
};

export function CtlButton({
  tone = "outline",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      type="button"
      className={cn(
        "mlabel inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-2 px-4 py-2.5 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime",
        "disabled:pointer-events-none disabled:opacity-40",
        TONES[tone],
        className
      )}
      {...rest}
    />
  );
}

/* ── runner status chip ─────────────────────────────────────── */

const STATUS_META: Record<RunnerStatus, { dot: string; text: string; live?: boolean }> = {
  RUNNING: { dot: "#aae83c", text: "text-lime", live: true },
  DEPLOYING: { dot: "#ffb224", text: "text-flame", live: true },
  PAUSED: { dot: "#ffb224", text: "text-flame" },
  PARKED: { dot: "#f0512a", text: "text-ember" },
  STOPPED: { dot: "#b3a98f", text: "text-foam" },
};

export function StatusChip({ status }: { status: RunnerStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.STOPPED;
  return (
    <span
      className={cn(
        "mlabel inline-flex items-center gap-2 rounded-full border-2 border-lined bg-panel2 px-3 py-1.5",
        m.text
      )}
    >
      <span
        className={cn("size-2 rounded-full", m.live && "blink")}
        style={{ background: m.dot }}
        aria-hidden
      />
      {status}
    </span>
  );
}

/* ── read-only policy chip (live config summary) ────────────── */

export function PolicyChip({
  label,
  value,
  tone = "cream",
}: {
  label: string;
  value: ReactNode;
  tone?: "cream" | "lime" | "flame" | "ember";
}) {
  const tones = {
    cream: "text-cream",
    lime: "text-lime",
    flame: "text-flame",
    ember: "text-ember",
  } as const;
  return (
    <span className="flex items-baseline gap-2 rounded-lg border-2 border-lined bg-panel2/60 px-3 py-2">
      <span className="mlabel shrink-0 whitespace-nowrap text-foam/70">{label}</span>
      <span className={cn("data whitespace-nowrap text-sm font-semibold", tones[tone])}>
        {value}
      </span>
    </span>
  );
}

/* ── editor field row ───────────────────────────────────────── */

export function FieldRow({
  label,
  live,
  value,
  hint,
  children,
}: {
  label: string;
  live?: ReactNode;
  value?: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="mlabel text-foam">{label}</span>
        <span className="flex items-baseline gap-2.5">
          {value != null && <span className="data text-sm font-semibold text-lime">{value}</span>}
          {live != null && (
            <span className="data whitespace-nowrap text-[10px] text-foam/60">LIVE {live}</span>
          )}
        </span>
      </div>
      {children}
      {hint && <div className="mlabel text-foam/50">{hint}</div>}
    </div>
  );
}

/* ── choice chips (single-select) ───────────────────────────── */

export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  render,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  render?: (o: T) => ReactNode;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={String(o)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o)}
            className={cn(
              "data flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime",
              on
                ? "border-lime bg-lime/15 text-lime"
                : "border-lined text-foam hover:border-foam/60 hover:text-cream"
            )}
          >
            {render ? render(o) : String(o)}
          </button>
        );
      })}
    </div>
  );
}
