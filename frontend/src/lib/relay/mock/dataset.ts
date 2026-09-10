/**
 * RELAY — mock dataset (source of truth for the demo).
 * ─────────────────────────────────────────────────────
 * Every number the UI shows is derived from this file or continued
 * forward by the simulation engine — nothing is invented in JSX.
 *
 * Canonical story: "Night Shift" (@marta) deployed with a $100.00
 * budget 4h16m ago. 17 laps settled: 13 W / 3 L / 1 V, streak ×7,
 * one shield consumed (lap 13), bankroll 100.00 → 142.10 (+$42.10).
 */

import {
  type AppNotification,
  type ArenaRunner,
  type BankrollPoint,
  type BoostRelationship,
  type Lap,
  type LapOutcome,
  type LapMarketSummary,
  type OrderRecord,
  type FillRecord,
  type Proof,
  type Runner,
  type RunnerConfig,
  type Side,
  type AssetId,
  type Wallet,
  type User,
  type StreakState,
  type PnlSnapshot,
} from "../types";
import { blockFor, marketId, questionId, rng, shortId, txHash } from "./id";

/* ── time anchors ───────────────────────────────────────────── */

export const BOOT = Date.now();
/** Lap 17 settled 40s before boot; lap 18 is already live. */
const LAST_SETTLE = BOOT - 40_000;
const LAP_MS = 15 * 60_000;
export const DEPLOYED_AT = LAST_SETTLE - 17 * LAP_MS - 70_000;

/* ── identity ───────────────────────────────────────────────── */

export const WALLET: Wallet = {
  address: "0x7C9e2b91D41a6f3Bd0c8Ee47A21B4C6dF5a9E318",
  network: "Somnia · Shannon testnet",
  chainId: 50312,
  tUSDC: 512.4,
  nativeSTT: 4.2069,
  connected: true,
};

export const USER: User = {
  id: "usr-marta",
  handle: "@marta",
  wallet: WALLET,
  joinedAt: BOOT - 61 * 86_400_000,
};

export const RUNNER_CONFIG: RunnerConfig = {
  bias: "FOLLOW",
  budget: 100,
  stopLoss: 30,
  baseStakePct: 0.06,
  streakMultiplier: 0.09,
  maxStakePct: 0.1,
  cadence: "15m",
  assets: ["BTC", "ETH"],
  shieldsMax: 2,
  headroomGatePct: 0.6,
};

export const RUNNER: Runner = {
  id: "run-nightshift",
  name: "Night Shift",
  ownerId: USER.id,
  ownerHandle: USER.handle,
  status: "RUNNING",
  deployedAt: DEPLOYED_AT,
  config: RUNNER_CONFIG,
  strategy: "Follow the Book · post-only → IOC",
};

/* ── market anchors ─────────────────────────────────────────── */

export const ASSET_META: Record<AssetId, { name: string; base: number; vol: number }> = {
  BTC: { name: "Bitcoin", base: 86_412.5, vol: 0.00042 },
  ETH: { name: "Ethereum", base: 2_917.3, vol: 0.00058 },
};

/* ── lap history (canonical spec) ───────────────────────────── */
/* pnl values sum to exactly +$42.10 — verified by construction.  */

interface LapSpec {
  n: number;
  out: LapOutcome;
  pnl: number;
  streakAfter: number;
  shielded: boolean;
  asset: AssetId;
  side: Side;
  entry: number; // side-terms price (what the runner paid per contract)
  stake: number;
  kind: "POST_ONLY" | "IOC";
}

const LAP_SPEC: LapSpec[] = [
  { n: 1, out: "WIN", pnl: 4.27, streakAfter: 1, shielded: false, asset: "BTC", side: "UP", entry: 0.652, stake: 8.0, kind: "POST_ONLY" },
  { n: 2, out: "WIN", pnl: 4.96, streakAfter: 2, shielded: false, asset: "BTC", side: "UP", entry: 0.617, stake: 8.06, kind: "POST_ONLY" },
  { n: 3, out: "LOSS", pnl: -8.0, streakAfter: 0, shielded: false, asset: "BTC", side: "UP", entry: 0.549, stake: 8.0, kind: "POST_ONLY" },
  { n: 4, out: "WIN", pnl: 3.71, streakAfter: 1, shielded: false, asset: "ETH", side: "DOWN", entry: 0.688, stake: 8.12, kind: "POST_ONLY" },
  { n: 5, out: "WIN", pnl: 4.4, streakAfter: 2, shielded: false, asset: "ETH", side: "DOWN", entry: 0.649, stake: 8.09, kind: "POST_ONLY" },
  { n: 6, out: "WIN", pnl: 4.88, streakAfter: 3, shielded: false, asset: "BTC", side: "UP", entry: 0.632, stake: 8.31, kind: "POST_ONLY" },
  { n: 7, out: "WIN", pnl: 5.46, streakAfter: 4, shielded: false, asset: "BTC", side: "UP", entry: 0.601, stake: 8.22, kind: "POST_ONLY" },
  { n: 8, out: "LOSS", pnl: -9.72, streakAfter: 0, shielded: false, asset: "BTC", side: "UP", entry: 0.566, stake: 9.72, kind: "IOC" },
  { n: 9, out: "WIN", pnl: 4.75, streakAfter: 1, shielded: false, asset: "ETH", side: "UP", entry: 0.628, stake: 8.04, kind: "POST_ONLY" },
  { n: 10, out: "WIN", pnl: 5.3, streakAfter: 2, shielded: false, asset: "ETH", side: "UP", entry: 0.598, stake: 7.9, kind: "POST_ONLY" },
  { n: 11, out: "VOID", pnl: 0, streakAfter: 2, shielded: false, asset: "BTC", side: "UP", entry: 0.575, stake: 9.4, kind: "POST_ONLY" },
  { n: 12, out: "WIN", pnl: 5.97, streakAfter: 3, shielded: false, asset: "BTC", side: "UP", entry: 0.596, stake: 8.81, kind: "IOC" },
  { n: 13, out: "LOSS", pnl: -11.05, streakAfter: 3, shielded: true, asset: "BTC", side: "UP", entry: 0.548, stake: 11.05, kind: "POST_ONLY" },
  { n: 14, out: "WIN", pnl: 6.25, streakAfter: 4, shielded: false, asset: "BTC", side: "UP", entry: 0.586, stake: 8.8, kind: "POST_ONLY" },
  { n: 15, out: "WIN", pnl: 6.88, streakAfter: 5, shielded: false, asset: "ETH", side: "UP", entry: 0.571, stake: 9.17, kind: "POST_ONLY" },
  { n: 16, out: "WIN", pnl: 6.51, streakAfter: 6, shielded: false, asset: "BTC", side: "UP", entry: 0.583, stake: 9.09, kind: "POST_ONLY" },
  { n: 17, out: "WIN", pnl: 7.53, streakAfter: 7, shielded: false, asset: "BTC", side: "UP", entry: 0.533, stake: 8.6, kind: "POST_ONLY" },
];

const OUTCOME_FOR: Record<string, "UP" | "DOWN" | "VOID"> = {
  "WIN|UP": "UP",
  "WIN|DOWN": "DOWN",
  "LOSS|UP": "DOWN",
  "LOSS|DOWN": "UP",
  "VOID|UP": "VOID",
  "VOID|DOWN": "VOID",
};

function buildLap(spec: LapSpec): Lap {
  const r = rng(spec.n * 7919);
  const windowEnd = LAST_SETTLE - (17 - spec.n) * LAP_MS;
  const windowStart = windowEnd - LAP_MS;
  const meta = ASSET_META[spec.asset];
  // walk the open price backward deterministically
  const drift = (r() - 0.5) * 0.004;
  const openPrice = +(meta.base * (1 + drift)).toFixed(spec.asset === "BTC" ? 1 : 2);
  // close respects the outcome
  const win = spec.out === "WIN";
  const mag = 0.0006 + r() * 0.0022;
  const dir = spec.out === "VOID" ? 0 : win ? 1 : -1;
  const closePrice = +(openPrice * (1 + dir * mag * (spec.side === "DOWN" ? -1 : 1))).toFixed(
    spec.asset === "BTC" ? 1 : 2
  );
  const mktId = marketId(`w${spec.n}-${spec.asset}`);
  const market: LapMarketSummary = {
    asset: spec.asset,
    label: `${spec.asset} Up or Down`,
    marketId: mktId,
    windowStart,
    windowEnd,
    openPrice,
    closePrice,
    cadence: "15m",
  };
  const placedAt = windowStart + Math.floor(LAP_MS * (0.12 + r() * 0.2));
  const latency = 286 + Math.floor(r() * 380);
  const quantity = +(spec.stake / spec.entry).toFixed(2);
  const order: OrderRecord = {
    id: `ord-${spec.n}`,
    kind: spec.kind,
    side: spec.side,
    price: spec.entry,
    quantity,
    stake: spec.stake,
    placedAt,
    status: "FILLED",
    tx: { hash: txHash(`o${spec.n}`), block: blockFor(`o${spec.n}`), at: placedAt },
    latencyMs: latency,
  };
  const fill: FillRecord = {
    id: `fil-${spec.n}`,
    orderId: order.id,
    price: spec.entry,
    quantity,
    filledAt: placedAt + latency,
    tx: { hash: txHash(`f${spec.n}`), block: blockFor(`o${spec.n}`) + 1, at: placedAt + latency },
  };
  const proof: Proof = {
    marketId: mktId,
    lap: spec.n,
    fillTx: fill.tx.hash,
    settlementTx: txHash(`s${spec.n}`),
    claimTx: spec.out === "VOID" ? txHash(`v${spec.n}`) : txHash(`c${spec.n}`),
    oracleQuestionId: questionId(`q${spec.n}`),
    status: "VERIFIED",
    sealedAt: windowEnd + 900,
  };
  return {
    number: spec.n,
    market,
    side: spec.side,
    stake: spec.stake,
    entryPrice: spec.entry,
    outcome: spec.out,
    marketOutcome: OUTCOME_FOR[`${spec.out}|${spec.side}`],
    pnl: spec.pnl,
    streakAfter: spec.streakAfter,
    shielded: spec.shielded,
    settledAt: windowEnd + 1_400,
    order,
    fill,
    proof,
  };
}

export const LAPS: Lap[] = LAP_SPEC.map(buildLap);
export const TOTAL_PNL = +LAPS.reduce((s, l) => s + l.pnl, 0).toFixed(2); // 42.10
export const START_BANKROLL = RUNNER_CONFIG.budget; // 100.00
export const BANKROLL = +(START_BANKROLL + TOTAL_PNL).toFixed(2); // 142.10

export const BANKROLL_SERIES: BankrollPoint[] = (() => {
  const pts: BankrollPoint[] = [
    { at: DEPLOYED_AT, bankroll: START_BANKROLL, lap: 0 },
  ];
  let b = START_BANKROLL;
  for (const l of LAPS) {
    b = +(b + l.pnl).toFixed(2);
    pts.push({ at: l.settledAt, bankroll: b, lap: l.number });
  }
  return pts;
})();

export const STREAK: StreakState = {
  current: 7,
  best: 7,
  shields: 1,
  shieldsMax: RUNNER_CONFIG.shieldsMax,
  nextShield: 0.6,
  protectedCount: 1,
};

export const PNL: PnlSnapshot = {
  realized: TOTAL_PNL,
  today: TOTAL_PNL,
  bankroll: BANKROLL,
  startBankroll: START_BANKROLL,
  peakBankroll: +Math.max(...BANKROLL_SERIES.map((p) => p.bankroll)).toFixed(2),
  drawdown: 0,
};

/* ── arena ──────────────────────────────────────────────────── */

interface ArenaSpec {
  name: string;
  handle: string;
  strategy: string;
  bias: "UP" | "DOWN" | "FOLLOW";
  streak: number;
  best: number;
  pnl7d: number;
  pnlLife: number;
  wr: number;
  laps: number;
  followers: number;
  boosters: number;
  status: "RUNNING" | "PAUSED";
  hue: number;
  shape: number;
}

const ARENA_SPEC: ArenaSpec[] = [
  { name: "Pheidippides", handle: "@kosto", strategy: "Follow the Book", bias: "FOLLOW", streak: 23, best: 31, pnl7d: 318.42, pnlLife: 1204.86, wr: 0.58, laps: 412, followers: 1241, boosters: 87, status: "RUNNING", hue: 82, shape: 0 },
  { name: "Momentum Machine", handle: "@quantval", strategy: "Momentum · UP", bias: "UP", streak: 11, best: 18, pnl7d: 221.06, pnlLife: 742.19, wr: 0.55, laps: 288, followers: 864, boosters: 52, status: "RUNNING", hue: 36, shape: 1 },
  { name: "Lap Dog", handle: "@marcusw", strategy: "Fade the Drift", bias: "DOWN", streak: 9, best: 14, pnl7d: 187.9, pnlLife: 401.33, wr: 0.61, laps: 173, followers: 512, boosters: 41, status: "RUNNING", hue: 16, shape: 2 },
  { name: "Velocity", handle: "@sashadrift", strategy: "Momentum · UP", bias: "UP", streak: 6, best: 12, pnl7d: 38.72, pnlLife: 96.4, wr: 0.54, laps: 74, followers: 218, boosters: 12, status: "RUNNING", hue: 52, shape: 3 },
  { name: "Miss Fibo", handle: "@fibonaccigirl", strategy: "Ladder Entries", bias: "FOLLOW", streak: 4, best: 9, pnl7d: 31.18, pnlLife: 58.02, wr: 0.57, laps: 61, followers: 187, boosters: 9, status: "RUNNING", hue: 66, shape: 0 },
  { name: "Cold Start", handle: "@n0va", strategy: "Follow the Book", bias: "FOLLOW", streak: 2, best: 7, pnl7d: 24.65, pnlLife: 31.44, wr: 0.56, laps: 39, followers: 96, boosters: 4, status: "RUNNING", hue: 96, shape: 1 },
  { name: "Relay Van Winkle", handle: "@drt", strategy: "Passive · post-only", bias: "UP", streak: 5, best: 8, pnl7d: 19.02, pnlLife: 44.71, wr: 0.52, laps: 52, followers: 141, boosters: 7, status: "RUNNING", hue: 28, shape: 2 },
  { name: "Fast Fill", handle: "@millisec", strategy: "Sniper · IOC", bias: "FOLLOW", streak: 1, best: 6, pnl7d: 14.37, pnlLife: 22.9, wr: 0.5, laps: 44, followers: 88, boosters: 3, status: "RUNNING", hue: 8, shape: 3 },
  { name: "Delta Hedgehog", handle: "@quills", strategy: "Two-Sided Mint", bias: "FOLLOW", streak: 3, best: 5, pnl7d: 11.84, pnlLife: 29.16, wr: 0.53, laps: 67, followers: 73, boosters: 2, status: "RUNNING", hue: 44, shape: 0 },
  { name: "Lighthouse", handle: "@beacondot", strategy: "Follow the Book", bias: "FOLLOW", streak: 8, best: 11, pnl7d: 9.6, pnlLife: 51.28, wr: 0.59, laps: 98, followers: 204, boosters: 14, status: "PAUSED", hue: 90, shape: 1 },
  { name: "Red Queen", handle: "@runfaster", strategy: "Momentum · DOWN", bias: "DOWN", streak: 0, best: 10, pnl7d: 7.23, pnlLife: -12.4, wr: 0.49, laps: 83, followers: 167, boosters: 11, status: "RUNNING", hue: 12, shape: 2 },
  { name: "Zeno", handle: "@halfdist", strategy: "Ladder Entries", bias: "FOLLOW", streak: 4, best: 6, pnl7d: 5.41, pnlLife: 18.67, wr: 0.51, laps: 121, followers: 59, boosters: 1, status: "RUNNING", hue: 72, shape: 3 },
  { name: "Block Runner", handle: "@0xgrid", strategy: "Momentum · UP", bias: "UP", streak: 2, best: 4, pnl7d: 3.88, pnlLife: 9.12, wr: 0.5, laps: 28, followers: 44, boosters: 2, status: "RUNNING", hue: 40, shape: 0 },
  { name: "Turtle Pass", handle: "@slowmo", strategy: "Passive · post-only", bias: "FOLLOW", streak: 6, best: 6, pnl7d: 2.15, pnlLife: 6.84, wr: 0.54, laps: 91, followers: 37, boosters: 0, status: "RUNNING", hue: 100, shape: 1 },
  { name: "Signum", handle: "@semaphore", strategy: "Fade the Drift", bias: "DOWN", streak: 1, best: 3, pnl7d: -1.27, pnlLife: 4.03, wr: 0.48, laps: 34, followers: 29, boosters: 1, status: "RUNNING", hue: 20, shape: 2 },
  { name: "Late Bloomer", handle: "@4hrmark", strategy: "Follow the Book", bias: "FOLLOW", streak: 0, best: 2, pnl7d: -4.82, pnlLife: -8.91, wr: 0.47, laps: 19, followers: 22, boosters: 0, status: "PAUSED", hue: 60, shape: 3 },
  { name: "Mr. Edgeworth", handle: "@edgecase", strategy: "Sniper · IOC", bias: "FOLLOW", streak: 3, best: 3, pnl7d: -6.4, pnlLife: -2.18, wr: 0.46, laps: 57, followers: 31, boosters: 2, status: "RUNNING", hue: 34, shape: 0 },
  { name: "Flatline", handle: "@stdev0", strategy: "Two-Sided Mint", bias: "FOLLOW", streak: 0, best: 5, pnl7d: -9.17, pnlLife: -21.63, wr: 0.44, laps: 103, followers: 18, boosters: 0, status: "RUNNING", hue: 0, shape: 1 },
  { name: "Rubber Band", handle: "@meanrev", strategy: "Fade the Drift", bias: "DOWN", streak: 1, best: 7, pnl7d: -13.52, pnlLife: -34.27, wr: 0.43, laps: 146, followers: 52, boosters: 3, status: "RUNNING", hue: 24, shape: 2 },
  { name: "Day Drinker", handle: "@after5", strategy: "Momentum · UP", bias: "UP", streak: 0, best: 1, pnl7d: -18.94, pnlLife: -44.85, wr: 0.41, laps: 62, followers: 14, boosters: 1, status: "PAUSED", hue: 48, shape: 3 },
  { name: "Sprint Zero", handle: "@premeptic", strategy: "Momentum · UP", bias: "UP", streak: 0, best: 1, pnl7d: -26.36, pnlLife: -61.72, wr: 0.38, laps: 47, followers: 9, boosters: 0, status: "RUNNING", hue: 14, shape: 0 },
];

function sparkFor(seed: number, end: number): number[] {
  const r = rng(seed);
  let v = end / (1 + (r() - 0.35) * 0.6);
  const out: number[] = [];
  for (let i = 0; i < 12; i++) {
    v = v * (1 + (r() - 0.48) * 0.05);
    out.push(+v.toFixed(2));
  }
  out[11] = +end.toFixed(2);
  return out;
}

export const ARENA: ArenaRunner[] = (() => {
  const you: ArenaRunner = {
    rank: 4,
    runnerId: RUNNER.id,
    name: RUNNER.name,
    ownerHandle: USER.handle,
    strategy: RUNNER.strategy,
    bias: "FOLLOW",
    streak: 7,
    bestStreak: 7,
    pnl7d: TOTAL_PNL,
    pnlLifetime: TOTAL_PNL,
    winRate: 13 / 16,
    laps: 17,
    followers: 34,
    boosters: 2,
    status: "RUNNING",
    delta: -2,
    verified: true,
    isYou: true,
    glyph: { hue: 74, shape: 1 },
    spark: BANKROLL_SERIES.filter((_, i) => i % 1 === 0).slice(-12).map((p) => p.bankroll),
  };
  const others = ARENA_SPEC.map((s, i) => ({
    rank: 0,
    runnerId: `run-${shortId(s.name)}`,
    name: s.name,
    ownerHandle: s.handle,
    strategy: s.strategy,
    bias: s.bias,
    streak: s.streak,
    bestStreak: s.best,
    pnl7d: s.pnl7d,
    pnlLifetime: s.pnlLife,
    winRate: s.wr,
    laps: s.laps,
    followers: s.followers,
    boosters: s.boosters,
    status: s.status,
    delta: [1, 0, 1, -2, 0, -1, 1, 2, 0, 1, 0, -1, 0, 1, -1, 0, 1, 0, -1, 1, 0][i] ?? 0,
    verified: true,
    glyph: { hue: s.hue, shape: s.shape },
    spark: sparkFor(i * 131 + 7, s.pnl7d < 0 ? 100 + s.pnl7d : 100 + s.pnl7d * 0.4),
  }));
  const all = [...others, you];
  all.sort((a, b) => b.pnl7d - a.pnl7d);
  all.forEach((a, i) => (a.rank = i + 1));
  return all;
})();

/* ── social graph ───────────────────────────────────────────── */

export const BOOSTS: BoostRelationship[] = [
  {
    runnerId: "run-8ff5d0a1",
    runnerName: "Velocity",
    amount: 10,
    boostedAt: BOOT - 2 * 3_600_000 + 240_000,
    mirroredRunnerId: "run-mirror-velocity",
  },
];

export const FOLLOWING = ["run-8ff5d0a1", "run-lapdog", "run-pheid"];

/* ── notifications ──────────────────────────────────────────── */

const lap17 = LAPS[16];
const lap16 = LAPS[15];
const lap13 = LAPS[12];
const lap11 = LAPS[10];

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: "ntf-arena-1",
    kind: "ARENA",
    title: "Night Shift climbed to #4",
    body: "Up 2 places in the 7-day arena. Pheidippides is 1 lap ahead of your pace.",
    at: lap17.settledAt + 2_000,
    read: false,
  },
  {
    id: "ntf-win-17",
    kind: "WIN",
    title: "Lap 17 complete — +$7.53",
    body: "BTC closed above the strike. Streak ×7 · bankroll $142.10 · re-armed for the 13:15 window.",
    at: lap17.settledAt + 1_200,
    read: false,
    lap: 17,
  },
  {
    id: "ntf-claim-17",
    kind: "CLAIM",
    title: "Winnings claimed — no button pressed",
    body: "Somnia Reactivity delivered the oracle answer and settled lap 17 in the same flow. 0 manual calls.",
    at: lap17.settledAt + 900,
    read: false,
    lap: 17,
  },
  {
    id: "ntf-fill-17",
    kind: "FILL",
    title: "Order filled · BTC 15m @ 53.3¢",
    body: "8.60 tUSDC in · 16.1 contracts · order→confirm 402ms · same block.",
    at: lap17.order.placedAt + 420,
    read: true,
    lap: 17,
  },
  {
    id: "ntf-streak-7",
    kind: "STREAK",
    title: "Streak ×7 — compounding",
    body: "Stake size scales with the streak. Next lap risks $13.90 — the hard cap is 10% of bankroll.",
    at: lap16.settledAt + 1_000,
    read: true,
    lap: 16,
  },
  {
    id: "ntf-boost-1",
    kind: "BOOST",
    title: "@velocity_boost boosted Night Shift",
    body: "$10.00 mirrored onto your config. They now earn your exact lap results.",
    at: BOOT - 5_400_000,
    read: true,
  },
  {
    id: "ntf-win-16",
    kind: "WIN",
    title: "Lap 16 complete — +$6.51",
    body: "BTC closed above the strike. Streak ×6 · bankroll $134.57.",
    at: lap16.settledAt + 1_200,
    read: true,
    lap: 16,
  },
  {
    id: "ntf-shield-13",
    kind: "SHIELD",
    title: "Shield consumed at lap 13",
    body: "The window resolved against you — your shield ate the loss and the streak survived. Tithe resumed.",
    at: lap13.settledAt + 1_000,
    read: true,
    lap: 13,
  },
  {
    id: "ntf-void-11",
    kind: "VOID",
    title: "Lap 11 voided — stake returned",
    body: "Oracle returned 0.5/0.5. A refund is not a loss: streak preserved, $9.40 returned.",
    at: lap11.settledAt + 1_000,
    read: true,
    lap: 11,
  },
  {
    id: "ntf-deploy",
    kind: "DEPLOY",
    title: "Night Shift deployed",
    body: "Budget $100.00 · stop-loss $30.00 · worst case bounded. The runner cannot withdraw your funds.",
    at: DEPLOYED_AT + 1_800,
    read: true,
  },
];

/* ── aggregates (derived — consistent by construction) ──────── */

export const WIN_RATE = 13 / 16;
export const WINS = 13;
export const LOSSES = 3;
export const VOIDS = 1;

export const HOUR_BUCKETS = (() => {
  // 6 buckets of ~4h across the session for the "performance by time" chart
  const laps = LAPS;
  const buckets = [0, 1, 2, 3, 4, 5].map((b) => {
    const rel = (l: Lap) => (l.settledAt - DEPLOYED_AT) / (4 * 3_600_000);
    const inb = laps.filter((l) => Math.floor(rel(l)) === b);
    const wins = inb.filter((l) => l.outcome === "WIN").length;
    return {
      bucket: b,
      label: `${["09", "10", "11", "12", "13", "14"][b]}:00`,
      laps: inb.length,
      wins,
      pnl: +inb.reduce((s, l) => s + l.pnl, 0).toFixed(2),
      winRate: inb.length ? wins / inb.length : 0,
    };
  });
  return buckets.filter((b) => b.laps > 0);
})();
