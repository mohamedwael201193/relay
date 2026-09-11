import type { LapPhase } from "../types";
import { mapBackendState } from "../mapping";
import type { HistoryLap, ProofBundle } from "../api/client";

/** Canonical lap phase order. UI interpolates skipped hops so CLOSE never vanishes. */
export const LAP_PHASE_ORDER: LapPhase[] = [
  "SCAN",
  "ARMED",
  "ORDER",
  "FILL",
  "HOLD",
  "CLOSING",
  "ORACLE",
  "RESULT",
  "CLAIM",
  "REARM",
];

export const IN_FLIGHT_STATES = new Set([
  "PREPARING",
  "ORDER_SUBMITTED",
  "PARTIAL_FILL",
  "FILLED",
  "WAITING_SETTLEMENT",
  "SETTLED_WIN",
  "SETTLED_LOSS",
  "SETTLED_VOID",
  "REDEEMING",
  "REDEEMED",
]);

const SETTLED = new Set(["SETTLED_WIN", "SETTLED_LOSS", "SETTLED_VOID", "REDEEMED", "REDEEMING"]);

export function intervalMsFromSec(intervalSec?: string | number | null): number {
  const n = Number(intervalSec);
  if (Number.isFinite(n) && n > 0) return n * 1000;
  return 900_000;
}

export function windowBounds(opts: {
  intervalMs: number;
  expirySec?: string | number | null;
  createdAt?: string | null;
  now: number;
  prev?: { opensAt: number; closesAt: number } | null;
}): { opensAt: number; closesAt: number } {
  const expiryMs =
    opts.expirySec != null && opts.expirySec !== "" ? Number(opts.expirySec) * 1000 : Number.NaN;
  if (Number.isFinite(expiryMs) && expiryMs > 0) {
    return { opensAt: expiryMs - opts.intervalMs, closesAt: expiryMs };
  }
  if (opts.prev && opts.prev.closesAt > 0 && opts.prev.opensAt > 0) {
    return { opensAt: opts.prev.opensAt, closesAt: opts.prev.closesAt };
  }
  const created = opts.createdAt ? Date.parse(opts.createdAt) : Number.NaN;
  if (Number.isFinite(created) && created > 0) {
    return { opensAt: created, closesAt: created + opts.intervalMs };
  }
  return { opensAt: opts.now, closesAt: opts.now + opts.intervalMs };
}

export function remainingMs(closeTimestamp: number, now: number): number {
  if (!Number.isFinite(closeTimestamp) || closeTimestamp <= 0) return Number.NaN;
  return Math.max(0, closeTimestamp - now);
}

export function serverSaysClosed(phase: LapPhase, closeTimestamp: number, now: number): boolean {
  if (phase === "CLOSING" || phase === "ORACLE" || phase === "RESULT" || phase === "CLAIM" || phase === "REARM") {
    return true;
  }
  return Number.isFinite(closeTimestamp) && closeTimestamp > 0 && now >= closeTimestamp;
}

/** Fill SCAN..`to` so a HOLD→RESULT hop still paints CLOSE and ORACLE as complete. */
export function interpolatePhaseHistory(to: LapPhase, prev: LapPhase[] | undefined, sameLap: boolean): LapPhase[] {
  const toIdx = LAP_PHASE_ORDER.indexOf(to);
  if (toIdx < 0) return [to];
  if (!sameLap) return LAP_PHASE_ORDER.slice(0, toIdx + 1);
  const reached = new Set(prev ?? []);
  for (let i = 0; i <= toIdx; i++) reached.add(LAP_PHASE_ORDER[i]!);
  return LAP_PHASE_ORDER.filter((p) => reached.has(p) && LAP_PHASE_ORDER.indexOf(p) <= toIdx);
}

/**
 * RESULT overlay owns the settled identity. If the worker already armed N+1,
 * Live stays on the settled lap until KEEP WATCHING — no fake delay, completed state.
 */
export function settleHoldLapIndex(opts: {
  overlayOpen: boolean;
  lastSettledLap: number | null | undefined;
  currentLapIndex: number;
}): number | null {
  if (!opts.overlayOpen) return null;
  const settled = opts.lastSettledLap ?? 0;
  if (settled <= 0) return null;
  if (opts.currentLapIndex > settled) return settled;
  return null;
}

/**
 * Map a settled history row onto a backend state Live can still paint.
 * Overlay hold keeps the settled lapId. Once N+1 exists, paint CLAIM then
 * RE-ARM as completed hops — worker often stays SETTLED_* after a 0-payout
 * redeem instead of REDEEMED.
 */
export function holdBackendState(histState: string, nextLapAlreadyStarted: boolean): string {
  if (!nextLapAlreadyStarted) return histState;
  if (histState === "REDEEMING") return "REDEEMING";
  if (
    histState === "REDEEMED" ||
    histState === "SETTLED_WIN" ||
    histState === "SETTLED_LOSS" ||
    histState === "SETTLED_VOID"
  ) {
    return "REARMING";
  }
  return histState;
}

export function isNewSettledResult(
  prevLaps: ReadonlyArray<{ number: number; outcome: string }>,
  resultLap: number | null | undefined,
): boolean {
  if (resultLap == null) return false;
  return prevLaps.some((l) => l.number === resultLap && l.outcome === "OPEN");
}

export function deriveVisualPhase(opts: {
  backendState: string;
  verifiedFill: boolean;
  now: number;
  closesAt: number;
  lastError: string | null;
  hasOracleAnswer: boolean;
  histState?: string | null;
}): LapPhase {
  const { backendState, verifiedFill, now, closesAt, histState } = opts;
  const mapped = mapBackendState(backendState);
  const closed = Number.isFinite(closesAt) && closesAt > 0 && now >= closesAt;

  if (backendState === "ORDER_SUBMITTED" && !verifiedFill) return "ORDER";
  if (backendState === "FILLED" && !verifiedFill) return "ORDER";
  if (backendState === "FILLED" && verifiedFill && !closed) {
    return mapped.phase === "FILL" ? "FILL" : "HOLD";
  }
  if (backendState === "WAITING_SETTLEMENT" || (backendState === "FILLED" && verifiedFill && closed)) {
    if (!closed) return "HOLD";
    return "ORACLE";
  }
  if (backendState === "SETTLED_WIN" || backendState === "SETTLED_LOSS" || backendState === "SETTLED_VOID") {
    return "RESULT";
  }
  if (backendState === "REDEEMING" || backendState === "REDEEMED") return "CLAIM";
  if (backendState === "REARMING") return "REARM";
  if (
    (backendState === "DISCOVERING" || backendState === "ACTIVE") &&
    histState &&
    SETTLED.has(histState)
  ) {
    return "REARM";
  }
  return mapped.phase ?? "SCAN";
}

export function hasOracleAnswer(opts: {
  hist?: HistoryLap;
  settlement?: ProofBundle["settlements"][number];
  lastError: string | null;
}): boolean {
  if (opts.lastError === "waiting_reactivity") return true;
  if (opts.settlement?.resolved) return true;
  const close = Number(opts.hist?.close_price);
  return Number.isFinite(close) && close > 0;
}

export function isInFlightState(state: string): boolean {
  return IN_FLIGHT_STATES.has(state);
}

export const ORACLE_DELAYED_AFTER_MS = 30_000;
export const FRESH_WINDOW_FRAC = 0.85;
const JOIN_HINT_AFTER_MS = 15_000;

export type OracleWaitStatus = "waiting_answer" | "answer_received" | "settling" | "resolved";

export function oracleWaitView(opts: {
  now: number;
  closesAt: number;
  hasOracleAnswer: boolean;
  lastError: string | null;
  questionId?: string | null;
  host: string;
  lastEventAt?: number;
  settled?: boolean;
}): {
  status: OracleWaitStatus;
  delayed: boolean;
  questionId: string | null;
  host: string;
  closedAgoMs: number;
  expectedAt: number;
  lastEventAt: number;
} {
  const closedAgoMs = Math.max(0, opts.now - opts.closesAt);
  let status: OracleWaitStatus = "waiting_answer";
  if (opts.settled) status = "resolved";
  else if (opts.lastError === "waiting_reactivity") status = "settling";
  else if (opts.hasOracleAnswer) status = "answer_received";
  return {
    status,
    delayed: status === "waiting_answer" && closedAgoMs >= ORACLE_DELAYED_AFTER_MS,
    questionId: opts.questionId && opts.questionId !== "0" ? opts.questionId : null,
    host: opts.host,
    closedAgoMs,
    expectedAt: opts.closesAt,
    lastEventAt: opts.lastEventAt && opts.lastEventAt > 0 ? opts.lastEventAt : opts.closesAt,
  };
}

export function nextEligibleWindow(
  windows: ReadonlyArray<{ opensAt: number; closesAt: number; cadence: string }>,
  cadence: string,
  now: number,
  freshFrac = FRESH_WINDOW_FRAC,
): { startsAt: number; remainingMs: number; cadence: string; kind: "opens" | "after_current" | "joinable" } | null {
  const same = windows.filter((w) => w.cadence === cadence && Number.isFinite(w.closesAt) && w.closesAt > now);
  if (!same.length) return null;
  const future = [...same].filter((w) => w.opensAt > now).sort((a, b) => a.opensAt - b.opensAt)[0];
  if (future) {
    return { startsAt: future.opensAt, remainingMs: future.opensAt - now, cadence, kind: "opens" };
  }
  const joinable = [...same]
    .filter((w) => {
      const total = w.closesAt - w.opensAt;
      return total > 0 && w.closesAt - now >= total * freshFrac;
    })
    .sort((a, b) => a.closesAt - b.closesAt)[0];
  if (joinable) {
    return { startsAt: joinable.opensAt, remainingMs: 0, cadence, kind: "joinable" };
  }
  const current = [...same].sort((a, b) => a.closesAt - b.closesAt)[0];
  if (!current) return null;
  return { startsAt: current.closesAt, remainingMs: current.closesAt - now, cadence, kind: "after_current" };
}

export function joinHint(opensAt: number, filledAt: number | null | undefined): { joinedAt: number } | null {
  if (!filledAt || !Number.isFinite(filledAt) || filledAt <= 0) return null;
  if (filledAt <= opensAt + JOIN_HINT_AFTER_MS) return null;
  return { joinedAt: filledAt };
}

export function measuredCloseToSettleMs(closeAt: number, settledAt: number | null | undefined): number | null {
  if (!Number.isFinite(closeAt) || closeAt <= 0) return null;
  if (!settledAt || !Number.isFinite(settledAt) || settledAt <= 0) return null;
  const ms = settledAt - closeAt;
  if (ms < 0) return null;
  return ms;
}
