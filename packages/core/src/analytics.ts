/**
 * Canonical runner analytics. Same formulas feed API arena, tape, and UI.
 *
 * WIN_RATE  = wins / (wins + losses)     — voids and open excluded
 * LOSS_RATE = losses / (wins + losses)
 * Decided   = wins + losses
 * Realized PnL = sum of pnl on WIN + LOSS + VOID (void redeem is real cashflow)
 * Open laps contribute exposure only, never win/loss/PnL
 *
 * Empty ≠ zero: rates are null when decided === 0.
 */

export type LapOutcomeKind = "WIN" | "LOSS" | "VOID" | "OPEN";

export type AnalyticsLap = {
  outcome: LapOutcomeKind;
  pnl: number;
  stake: number;
  entryPrice: number;
  settledAt: number;
  asset?: string;
  cadence?: string;
};

export type RunnerAnalytics = {
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
  medianStake: number | null;
  averageEntry: number | null;
  averageRealizedReturn: number | null;
  sampleN: number;
};

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

export function outcomeFromState(state: string): LapOutcomeKind | null {
  if (state === "SETTLED_WIN" || state === "REDEEMED") return "WIN";
  if (state === "SETTLED_LOSS") return "LOSS";
  if (state === "SETTLED_VOID") return "VOID";
  if (
    state === "FILLED" ||
    state === "PARTIAL_FILL" ||
    state === "ORDER_SUBMITTED" ||
    state === "WAITING_SETTLEMENT"
  ) {
    return "OPEN";
  }
  return null;
}

export function summarizeLaps(laps: AnalyticsLap[]): RunnerAnalytics {
  const wins = laps.filter((l) => l.outcome === "WIN").length;
  const losses = laps.filter((l) => l.outcome === "LOSS").length;
  const voids = laps.filter((l) => l.outcome === "VOID").length;
  const open = laps.filter((l) => l.outcome === "OPEN").length;
  const decided = wins + losses;
  const closed = laps.filter((l) => l.outcome !== "OPEN");
  const realized = closed.reduce((a, l) => a + l.pnl, 0);
  const stakes = laps.map((l) => l.stake).filter((s) => Number.isFinite(s) && s > 0);
  const entries = laps.map((l) => l.entryPrice).filter((p) => Number.isFinite(p) && p > 0);
  return {
    totalLaps: laps.length,
    decided,
    wins,
    losses,
    voids,
    open,
    winRate: decided > 0 ? wins / decided : null,
    lossRate: decided > 0 ? losses / decided : null,
    netPnl: closed.length > 0 ? realized : null,
    realizedPnl: closed.length > 0 ? realized : null,
    averageStake: stakes.length > 0 ? stakes.reduce((a, b) => a + b, 0) / stakes.length : null,
    medianStake: median(stakes),
    averageEntry: entries.length > 0 ? entries.reduce((a, b) => a + b, 0) / entries.length : null,
    averageRealizedReturn: closed.length > 0 ? realized / closed.length : null,
    sampleN: decided,
  };
}

export type StreakInput = LapOutcomeKind | { outcome: LapOutcomeKind; shielded?: boolean };

function streakKind(item: StreakInput): { outcome: LapOutcomeKind; shielded: boolean } {
  if (typeof item === "string") return { outcome: item, shielded: false };
  return { outcome: item.outcome, shielded: Boolean(item.shielded) };
}

/** Consecutive verified wins. Voids and shielded losses keep the run; open/pending do not break or extend it. */
export function streakFromOutcomes(outcomes: StreakInput[]): { current: number; best: number } {
  let run = 0;
  let best = 0;
  for (const item of outcomes) {
    const { outcome: o, shielded } = streakKind(item);
    if (o === "VOID" || o === "OPEN") continue;
    if (o === "LOSS" && shielded) continue;
    if (o === "WIN") {
      run += 1;
      if (run > best) best = run;
    } else if (o === "LOSS") {
      run = 0;
    }
  }
  return { current: run, best };
}

/**
 * Fair-coin expected PnL from a YES buy: 0.5×qty − cost, with cost≈entry×qty.
 * Not a claimed edge. Null when there is no priced tape.
 */
export function expectedFairPnl(laps: AnalyticsLap[]): number | null {
  const priced = laps.filter((l) => l.entryPrice > 0 && l.stake > 0);
  if (priced.length === 0) return null;
  const total = priced.reduce((a, l) => {
    const qty = l.stake / l.entryPrice;
    return a + (0.5 * qty - l.stake);
  }, 0);
  return total / priced.length;
}

export type ArenaAggInput = {
  vault: string;
  owner: string;
  state: string;
  lap_state: string | null;
  pnl: string | null;
  created_at?: string | null;
  bias?: string | null;
  interval_sec?: string | null;
  assets?: string[] | null;
  shielded?: boolean | string | null;
};

export type ArenaAggRow = {
  vault: string;
  owner: string;
  state: string;
  verified_laps: number;
  wins: number;
  losses: number;
  voids: number;
  open: number;
  decided: number;
  win_rate: number | null;
  pnl_raw: string;
  pnl_7d_raw: string;
  streak: number;
  best_streak: number;
  bias: string;
  interval_sec: string;
  assets: string[];
};

/** Fold join rows (one per lap, or a runner with no laps) into arena public stats. */
export function aggregateArena(rows: ArenaAggInput[]): ArenaAggRow[] {
  const byVault = new Map<string, ArenaAggInput[]>();
  for (const r of rows) {
    const list = byVault.get(r.vault) ?? [];
    list.push(r);
    byVault.set(r.vault, list);
  }
  const out: ArenaAggRow[] = [];
  for (const [vault, list] of byVault) {
    const head = list[0];
    const outcomes: StreakInput[] = [];
    let pnl = 0n;
    let pnl7d = 0n;
    let hasPnl = false;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const row of list) {
      if (!row.lap_state) continue;
      const o = outcomeFromState(row.lap_state);
      if (!o) continue;
      const shielded =
        row.shielded === true || row.shielded === "t" || row.shielded === "true";
      outcomes.push({ outcome: o, shielded });
      if (row.pnl != null && row.pnl !== "" && o !== "OPEN") {
        const v = BigInt(row.pnl);
        pnl += v;
        hasPnl = true;
        const at = row.created_at ? Date.parse(row.created_at) : NaN;
        if (!Number.isFinite(at) || at >= weekAgo) pnl7d += v;
      }
    }
    const stats = summarizeLaps(
      outcomes.map((item) => ({
        outcome: streakKind(item).outcome,
        pnl: 0,
        stake: 0,
        entryPrice: 0,
        settledAt: 0,
      })),
    );
    const streak = streakFromOutcomes(outcomes);
    out.push({
      vault,
      owner: head.owner,
      state: head.state,
      verified_laps: stats.decided + stats.voids,
      wins: stats.wins,
      losses: stats.losses,
      voids: stats.voids,
      open: stats.open,
      decided: stats.decided,
      win_rate: stats.winRate,
      pnl_raw: hasPnl ? pnl.toString() : "",
      pnl_7d_raw: hasPnl ? pnl7d.toString() : "",
      streak: streak.current,
      best_streak: streak.best,
      bias: head.bias && head.bias !== "" ? head.bias : "FOLLOW",
      interval_sec: head.interval_sec && head.interval_sec !== "" ? head.interval_sec : "60",
      assets: Array.isArray(head.assets) && head.assets.length ? head.assets : ["BTC", "ETH"],
    });
  }
  out.sort((a, b) => {
    if (b.verified_laps !== a.verified_laps) return b.verified_laps - a.verified_laps;
    const pa = BigInt(a.pnl_raw);
    const pb = BigInt(b.pnl_raw);
    if (pa === pb) return a.vault.localeCompare(b.vault);
    return pa > pb ? -1 : 1;
  });
  return out;
}
