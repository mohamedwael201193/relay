import {
  outcomeFromState,
  streakFromOutcomes,
  summarizeLaps,
  type RunnerAnalytics,
} from "./analytics.js";
import { derivedPnlRaw } from "./settleGate.js";

export type TapeVerifyRow = {
  lap_index: number;
  state: string;
  entry_cost?: string | null;
  redeem_value?: string | null;
  pnl?: string | null;
  shielded?: boolean | string | null;
  fill_class?: string | null;
  fill_tx?: string | null;
  redeem_tx?: string | null;
};

export type TapeVerifyFlag = { lap: number; code: string; detail: string };

export type TapeVerifyReport = {
  ok: boolean;
  flags: TapeVerifyFlag[];
  stats: RunnerAnalytics;
  streak: { current: number; best: number };
};

function asBig(raw: string | null | undefined): bigint | null {
  if (raw == null || raw === "") return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

/** Replay a vault tape and flag missing fills, invented open PnL, and escrow/redeem mismatches. */
export function verifyTape(rows: TapeVerifyRow[]): TapeVerifyReport {
  const flags: TapeVerifyFlag[] = [];
  const analyticsLaps = [];
  for (const r of rows) {
    const outcome = outcomeFromState(r.state);
    const fillOk = r.fill_class === "FILL" || r.fill_class === "PARTIAL_FILL";
    if (outcome && !fillOk) {
      flags.push({
        lap: r.lap_index,
        code: "missing_verified_fill",
        detail: r.fill_class ?? "none",
      });
    }
    if (outcome === "OPEN" && r.pnl === "0") {
      flags.push({ lap: r.lap_index, code: "open_zero_pnl", detail: "open laps must not print 0" });
    }
    const derived = derivedPnlRaw(r.pnl, r.entry_cost, r.redeem_value);
    const entry = asBig(r.entry_cost);
    const redeem = asBig(r.redeem_value);
    const stored = asBig(r.pnl);
    if (entry != null && redeem != null && stored != null && derived != null && BigInt(derived) !== stored) {
      flags.push({
        lap: r.lap_index,
        code: "pnl_mismatch",
        detail: `stored=${stored} derived=${derived} entry=${entry} redeem=${redeem}`,
      });
    }
    if (outcome === "WIN" && fillOk && redeem != null && redeem > 0n && !r.redeem_tx) {
      flags.push({ lap: r.lap_index, code: "missing_claim_proof", detail: "win with payout and no redeem_tx" });
    }
    if (!outcome) continue;
    const stake = entry != null ? Number(entry) / 1e6 : 0;
    const pnl = stored != null ? Number(stored) / 1e6 : Number.NaN;
    analyticsLaps.push({
      outcome,
      pnl: Number.isFinite(pnl) ? pnl : 0,
      stake,
      entryPrice: 0,
      settledAt: r.lap_index,
    });
  }
  const stats = summarizeLaps(analyticsLaps);
  const streak = streakFromOutcomes(
    rows.flatMap((r) => {
      const outcome = outcomeFromState(r.state);
      if (!outcome) return [];
      const shielded = r.shielded === true || r.shielded === "t" || r.shielded === "true";
      return [{ outcome, shielded }];
    }),
  );
  return { ok: flags.length === 0, flags, stats, streak };
}
