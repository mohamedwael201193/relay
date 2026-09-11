"use client";

import { useEffect, useState } from "react";
import { countdown } from "../format";
import { remainingMs, serverSaysClosed } from "./activeLap";
import type { LapPhase } from "../types";

/**
 * Visual ticker off an authoritative close timestamp.
 * Does not poll the API. Rebases when `closeTimestamp` changes (SSE/sync).
 */
export function useCloseCountdown(
  closeTimestamp: number | undefined,
  phase: LapPhase | undefined,
): { remainingMs: number; label: string; closed: boolean } {
  const [now, setNow] = useState(() => Date.now());
  const closed = Boolean(phase && closeTimestamp != null && serverSaysClosed(phase, closeTimestamp, now));

  useEffect(() => {
    if (closed || !closeTimestamp) return;
    let raf = 0;
    let lastSec = Math.floor(Date.now() / 1000);
    const tick = () => {
      const t = Date.now();
      const sec = Math.floor(t / 1000);
      if (sec !== lastSec) {
        lastSec = sec;
        setNow(t);
      }
      if (t < closeTimestamp) raf = requestAnimationFrame(tick);
      else setNow(t);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [closeTimestamp, closed]);

  if (!closeTimestamp || !Number.isFinite(closeTimestamp)) {
    return { remainingMs: Number.NaN, label: "—", closed: false };
  }
  if (closed || now >= closeTimestamp) {
    return { remainingMs: 0, label: "CLOSED", closed: true };
  }
  const left = remainingMs(closeTimestamp, now);
  if (!Number.isFinite(left)) return { remainingMs: Number.NaN, label: "—", closed: false };
  return { remainingMs: left, label: countdown(left), closed: false };
}
