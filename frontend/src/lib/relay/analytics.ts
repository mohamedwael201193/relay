/**
 * Canonical tape analytics (browser). Keep formulas aligned with
 * packages/core/src/analytics.ts:
 * WIN_RATE = wins / (wins + losses); voids and open excluded.
 * Empty ≠ zero: rates are null when decided === 0.
 */

import type { Lap, LapOutcome, LapResult } from "./types";

export type TapeStats = {
  totalLaps: number;
  decided: number;
  wins: number;
  losses: number;
  voids: number;
  open: number;
  winRate: number | null;
  lossRate: number | null;
  netPnl: number | null;
  realizedPnl: number | null;
  averageStake: number | null;
  sampleN: number;
  bestStreak: number;
  averageRealizedReturn: number | null;
};

export function summarizeTape(laps: Lap[]): TapeStats {
  const wins = laps.filter((l) => l.outcome === "WIN").length;
  const losses = laps.filter((l) => l.outcome === "LOSS").length;
  const voids = laps.filter((l) => l.outcome === "VOID").length;
  const open = laps.filter((l) => l.outcome === "OPEN").length;
  const decided = wins + losses;
  const closed = laps.filter((l) => l.outcome !== "OPEN");
  const withPnl = closed.filter((l) => Number.isFinite(l.pnl));
  const realized = withPnl.reduce((a, l) => a + l.pnl, 0);
  const stakes = laps.map((l) => l.stake).filter((s) => s > 0);
  const bestStreak = laps.reduce((m, l) => Math.max(m, l.streakAfter), 0);
  return {
    totalLaps: laps.length,
    decided,
    wins,
    losses,
    voids,
    open,
    winRate: decided > 0 ? wins / decided : null,
    lossRate: decided > 0 ? losses / decided : null,
    netPnl: withPnl.length > 0 ? realized : null,
    realizedPnl: withPnl.length > 0 ? realized : null,
    averageStake: stakes.length > 0 ? stakes.reduce((a, b) => a + b, 0) / stakes.length : null,
    sampleN: decided,
    bestStreak,
    averageRealizedReturn: withPnl.length > 0 ? realized / withPnl.length : null,
  };
}

/** Fair-coin expected PnL per priced lap: 0.5×qty − stake. Not a claimed edge. */
export function expectedFairPerLap(laps: Lap[]): number | null {
  const priced = laps.filter((l) => l.entryPrice > 0 && l.stake > 0);
  if (priced.length === 0) return null;
  const total = priced.reduce((a, l) => a + (0.5 * (l.stake / l.entryPrice) - l.stake), 0);
  return total / priced.length;
}

export function resultFromLap(lap: Lap, bankrollAfter: number): LapResult | null {
  if (lap.outcome === "OPEN") return null;
  return {
    lap: lap.number,
    outcome: lap.outcome,
    side: lap.side,
    asset: lap.market.asset,
    stake: lap.stake,
    entryPrice: lap.entryPrice,
    closePrice: lap.market.closePrice,
    openPrice: lap.market.openPrice,
    pnl: lap.pnl,
    streakBefore: Math.max(0, lap.streakAfter - (lap.outcome === "WIN" ? 1 : 0)),
    streakAfter: lap.streakAfter,
    shieldUsed: lap.shielded,
    bankrollBefore: bankrollAfter - lap.pnl,
    bankrollAfter,
    nextMarket: null,
    proof: lap.proof,
    at: lap.settledAt,
  };
}

export function dashRate(rate: number | null): string {
  return rate == null ? "—" : `${(rate * 100).toFixed(1)}%`;
}

export type { LapOutcome };
