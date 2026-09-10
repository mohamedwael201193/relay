/**
 * RELAY — Live Lap screen helpers.
 * Phase tones (mirroring LapRing), side-adjusted math, value flash hook.
 */

import { useEffect, useRef, useState } from "react";
import type { LapEvent, LapPhase, Side } from "@/lib/relay/types";

/** Broadcast tone per phase — same voice as LapRing's phaseTone. */
export const PHASE_TONE: Record<LapPhase, string> = {
  SCAN: "#b3a98f",
  ARMED: "#ffb224",
  ORDER: "#ffb224",
  FILL: "#aae83c",
  HOLD: "#aae83c",
  CLOSING: "#f0512a",
  ORACLE: "#e8d5a8",
  RESULT: "#ffb224",
  CLAIM: "#aae83c",
  REARM: "#aae83c",
};

/** Tone for a feed row's kind chip (phase events + INFO). */
export const EVENT_TONE: Record<LapEvent["kind"], string> = {
  ...PHASE_TONE,
  INFO: "#b3a98f",
};

export function eventTone(kind: LapEvent["kind"]): string {
  return EVENT_TONE[kind] ?? "#b3a98f";
}

/**
 * Entry price in UP terms so a DOWN position's entry line can be plotted
 * against the same axis as the UP-terms chart.
 */
export function entryUpTerms(
  entry: number | null | undefined,
  side: Side | null | undefined
): number | null {
  if (entry == null || side == null) return null;
  return side === "DOWN" ? 1 - entry : entry;
}

/** Relative change of price vs the window's open, as a fraction. */
export function pctChange(price: number, open: number): number {
  if (!open) return 0;
  return (price - open) / open;
}

/**
 * Brief up/down flash keyed on a changing number (money + price moves).
 * Returns a `key` to force remount and a tone to tint the value.
 */
export function useFlash(
  value: number,
  ms = 700
): { key: number; tone: "up" | "down" | null } {
  const prev = useRef<number>(value);
  const [state, setState] = useState<{ key: number; tone: "up" | "down" | null }>({
    key: 0,
    tone: null,
  });

  useEffect(() => {
    const before = prev.current;
    if (before === value) return;
    prev.current = value;
    const tone: "up" | "down" = value > before ? "up" : "down";
    /* paint-synced (rAF) so the flash lands with the new number, not a frame late */
    const raf = requestAnimationFrame(() => setState((s) => ({ key: s.key + 1, tone })));
    const t = setTimeout(() => setState((s) => ({ ...s, tone: null })), ms);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [value, ms]);

  return state;
}
