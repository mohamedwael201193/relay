"use client";

import { useRelay } from "../engine/store";
import { countdown } from "../format";
import { remainingMs, serverSaysClosed } from "./activeLap";
import type { LapPhase } from "../types";

/**
 * Visual ticker off an authoritative close timestamp + the shared store `now`.
 * LiveBridge ticks `now` once per second. Does not poll the API.
 * Rebases when SSE/sync replaces `closeTimestamp` because remaining is
 * `closeTimestamp - now`.
 */
export function useCloseCountdown(
  closeTimestamp: number | undefined,
  phase: LapPhase | undefined,
): { remainingMs: number; label: string; closed: boolean } {
  const now = useRelay((s) => s.now);

  if (!closeTimestamp || !Number.isFinite(closeTimestamp)) {
    return { remainingMs: Number.NaN, label: "—", closed: false };
  }
  const closed = Boolean(phase && serverSaysClosed(phase, closeTimestamp, now));
  if (closed || now >= closeTimestamp) {
    return { remainingMs: 0, label: "CLOSED", closed: true };
  }
  const left = remainingMs(closeTimestamp, now);
  if (!Number.isFinite(left)) return { remainingMs: Number.NaN, label: "—", closed: false };
  return { remainingMs: left, label: countdown(left), closed: false };
}
