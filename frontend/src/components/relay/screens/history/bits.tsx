"use client";

/**
 * RELAY — tape bits.
 * Small typed parts for the tape rows: side chips, outcome chips
 * (with the shield tooltip), and mono receipt rows.
 */

import type { ReactNode } from "react";
import { Check, Copy, Minus, X } from "lucide-react";
import type { LapOutcome, Side } from "@/lib/relay/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldMark } from "../../identity/identity";
import { cn } from "@/lib/utils";

/** Desktop ledger grid — shared by the column header and every tape row. */
export const TAPE_GRID =
  "lg:grid-cols-[3.25rem_minmax(10rem,1.6fr)_5.5rem_minmax(6.5rem,1fr)_6.75rem_6.5rem_4.75rem_5.5rem_1.5rem]";

/* ── side ─────────────────────────────────────────────────────── */

export function SideChip({ side }: { side: Side }) {
  const up = side === "UP";
  return (
    <span
      className={cn(
        "mlabel inline-flex items-center gap-1 whitespace-nowrap rounded-md border-2 px-1.5 py-0.5",
        up
          ? "border-limedeep/50 bg-lime/15 text-lime"
          : "border-emberdeep/50 bg-ember/15 text-ember"
      )}
    >
      {up ? "▲ UP" : "▼ DOWN"}
    </span>
  );
}

/* ── outcome ──────────────────────────────────────────────────── */

const OUTCOME_META: Record<
  LapOutcome,
  { label: string; cls: string; icon: ReactNode }
> = {
  WIN: {
    label: "WIN",
    cls: "bg-lime text-graphite border-graphite",
    icon: <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />,
  },
  LOSS: {
    label: "LOSS",
    cls: "bg-ember text-cream border-graphite",
    icon: <X className="h-3 w-3" strokeWidth={3.5} aria-hidden />,
  },
  VOID: {
    label: "VOID",
    cls: "bg-panel2 text-foam border-lined",
    icon: <Minus className="h-3 w-3" strokeWidth={3.5} aria-hidden />,
  },
  OPEN: {
    label: "FILL",
    cls: "bg-lime/15 text-lime border-limedeep/50",
    icon: <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />,
  },
};

export function OutcomeChip({ outcome, shielded }: { outcome: LapOutcome; shielded: boolean }) {
  const m = OUTCOME_META[outcome];
  const chip = (
    <span className="relative inline-flex">
      <span
        className={cn(
          "mlabel inline-flex items-center gap-1 rounded-md border-2 px-2 py-0.5",
          m.cls,
          shielded && "ring-2 ring-flame"
        )}
      >
        {m.icon}
        {m.label}
      </span>
      {shielded && (
        <ShieldMark className="absolute -right-2 -top-2.5 h-3.5 w-3.5" aria-hidden />
      )}
    </span>
  );

  if (!shielded) return chip;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help">{chip}</span>
      </TooltipTrigger>
      <TooltipContent
        sideOffset={6}
        className="border-2 border-lined bg-panel2 text-xs font-normal text-cream"
      >
        shield absorbed — streak preserved
      </TooltipContent>
    </Tooltip>
  );
}

/* ── receipt mono row ─────────────────────────────────────────── */

export function MonoRow({
  label,
  value,
  tone = "cream",
}: {
  label: string;
  value: ReactNode;
  tone?: "cream" | "lime" | "ember" | "foam" | "flame";
}) {
  const tones = {
    cream: "text-cream",
    lime: "text-lime",
    ember: "text-ember",
    foam: "text-foam",
    flame: "text-flame",
  } as const;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-lined/70 py-1.5 last:border-b-0 min-w-0">
      <span className="mlabel shrink-0 text-foam/75">{label}</span>
      <span className={cn("data min-w-0 max-w-[70%] break-all text-right text-xs leading-snug", tones[tone])}>{value}</span>
    </div>
  );
}

export function HashRow({ label, hash }: { label: string; hash: string }) {
  if (!hash) {
    return <MonoRow label={label} value="—" tone="foam" />;
  }
  return (
    <div className="flex items-center justify-between gap-2 border-b border-lined/70 py-1.5 last:border-b-0 min-w-0">
      <span className="mlabel shrink-0 text-foam/75">{label}</span>
      <span className="inline-flex min-w-0 items-center gap-1">
        <span className="data truncate text-xs text-foam">{hash.length > 18 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash}</span>
        <CopyHashButton text={hash} />
      </span>
    </div>
  );
}

function CopyHashButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void navigator.clipboard.writeText(text).catch(() => undefined);
      }}
      className="shrink-0 rounded-md p-1 text-foam/70 hover:bg-panel2 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
    >
      <Copy className="h-3 w-3" aria-hidden />
    </button>
  );
}
