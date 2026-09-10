/**
 * RELAY — data contracts
 * ──────────────────────
 * These types are the seam between the current mock/simulation layer
 * and the future DreamDEX SDK / Somnia indexer backend. Screens must
 * consume ONLY these normalized shapes (via the zustand store) — never
 * inline fake data in JSX.
 */

/* ── primitives ─────────────────────────────────────────────── */

export type AssetId = "BTC" | "ETH";

/** Strategy bias of a runner. */
export type Bias = "UP" | "DOWN" | "FOLLOW";

/** Contract side a runner took in a given lap. */
export type Side = "UP" | "DOWN";

/** Oracle outcome of a settled window. */
export type Outcome = "UP" | "DOWN" | "VOID";

/** Result of a lap from the runner's perspective. */
export type LapOutcome = "WIN" | "LOSS" | "VOID" | "OPEN";

export type RunnerStatus =
  | "DEPLOYING"
  | "RUNNING"
  | "PAUSED"
  | "PARKED"
  | "STOPPED";

export type WindowCadence = "1m" | "5m" | "15m" | "1h";

/** Live phase machine of an in-flight lap. */
export type LapPhase =
  | "SCAN" // discovering successor window
  | "ARMED" // decision prepared, waiting for entry window
  | "ORDER" // order submitted, awaiting confirm
  | "FILL" // fill landed, receipt building
  | "HOLD" // position held while window runs
  | "CLOSING" // final stretch of the window
  | "ORACLE" // window expired, answer arriving via Reactivity
  | "RESULT" // outcome revealed
  | "CLAIM" // winnings claimed automatically
  | "REARM"; // baton pass to the next window

export interface TxRef {
  hash: string;
  block: number;
  at: number; // epoch ms (sim clock)
}

/* ── identity & wallet ──────────────────────────────────────── */

export interface User {
  id: string;
  handle: string;
  wallet: Wallet;
  joinedAt: number;
}

export interface Wallet {
  address: string; // 0x…
  network: string; // "Somnia · Shannon testnet"
  chainId: number;
  tUSDC: number; // spendable balance
  nativeSTT: number; // gas
  connected: boolean;
}

/* ── runner & config ────────────────────────────────────────── */

export interface RunnerConfig {
  bias: Bias;
  /** Max bankroll the runner may ever trade (deployment budget). */
  budget: number;
  /** Hard stop-loss — runner parks when total drawdown hits this. */
  stopLoss: number;
  /** Base stake as fraction of current bankroll. */
  baseStakePct: number;
  /** Streak compounding factor λ: stake_n = base × (1 + λ·n). */
  streakMultiplier: number;
  /** Ceiling for compounded stake as fraction of bankroll. */
  maxStakePct: number;
  cadence: WindowCadence;
  assets: AssetId[];
  /** Max streak shields held simultaneously. */
  shieldsMax: number;
  /** Refuses entry after this fraction of the window has elapsed. */
  headroomGatePct: number;
}

export interface Runner {
  id: string;
  name: string;
  ownerId: string;
  ownerHandle: string;
  status: RunnerStatus;
  deployedAt: number; // epoch ms (sim clock)
  config: RunnerConfig;
  strategy: string; // human label, e.g. "Momentum Follow · post-only → IOC"
}

/* ── markets ────────────────────────────────────────────────── */

export interface MarketWindow {
  id: string; // stable id
  marketId: string; // 0x… venue market id
  asset: AssetId;
  label: string; // "BTC Up or Down"
  cadence: WindowCadence;
  /** Strike / opening price of the underlying at window open. */
  openPrice: number;
  opensAt: number;
  closesAt: number;
  venue: string; // "DreamDEX · Event Contracts"
  collateral: "tUSDC" | "USDso";
  /** true while this window is tradable */
  live: boolean;
}

export interface BookLevel {
  price: number; // Up-probability terms
  size: number; // contracts
}

/** Four-sided book snapshot quoted in UP terms. */
export interface BookSnapshot {
  bidUp: BookLevel[];
  askUp: BookLevel[];
  bidDown: BookLevel[];
  askDown: BookLevel[];
  spread: number;
}

/* ── orders / fills / positions ─────────────────────────────── */

export interface OrderRecord {
  id: string;
  kind: "POST_ONLY" | "IOC";
  side: Side;
  price: number; // UP-terms probability
  quantity: number; // contracts
  stake: number; // collateral committed
  placedAt: number;
  status: "PLACED" | "FILLED" | "EXPIRED";
  tx: TxRef;
  /** submit → confirm, ms */
  latencyMs: number;
}

export interface FillRecord {
  id: string;
  orderId: string;
  price: number;
  quantity: number;
  filledAt: number;
  tx: TxRef;
}

export interface Position {
  id: string;
  lapNumber: number;
  marketId: string;
  side: Side;
  stake: number;
  entryPrice: number; // price paid per contract in this side's terms
  quantity: number; // contracts = stake / entryPrice
  markPrice: number; // current fair in the same terms as entryPrice
}

/* ── proof / verification ───────────────────────────────────── */

export interface Proof {
  marketId: string;
  lap: number;
  fillTx: string;
  settlementTx: string;
  claimTx: string;
  oracleQuestionId: string;
  status: "VERIFIED" | "PENDING";
  sealedAt: number;
}

/* ── laps & history ─────────────────────────────────────────── */

export interface LapMarketSummary {
  asset: AssetId;
  label: string;
  marketId: string;
  windowStart: number;
  windowEnd: number;
  openPrice: number;
  closePrice: number;
  cadence: WindowCadence;
}

/** A settled lap — the atomic unit of RELAY history. */
export interface Lap {
  number: number;
  market: LapMarketSummary;
  side: Side;
  stake: number;
  entryPrice: number;
  outcome: LapOutcome;
  marketOutcome: Outcome;
  pnl: number; // + win / − loss / 0 void
  streakAfter: number;
  shielded: boolean; // shield absorbed this loss
  settledAt: number;
  order: OrderRecord;
  fill: FillRecord;
  proof: Proof;
}

export interface StreakState {
  current: number;
  best: number;
  shields: number;
  shieldsMax: number;
  /** tithe progress toward the next shield, 0..1 */
  nextShield: number;
  /** lifetime losses absorbed by shields */
  protectedCount: number;
}

export interface PnlSnapshot {
  realized: number; // lifetime realized PnL
  today: number;
  bankroll: number;
  startBankroll: number;
  peakBankroll: number;
  drawdown: number; // current drawdown from peak, positive number
}

/* ── live lap (simulation surface) ──────────────────────────── */

export interface LapEvent {
  id: string;
  at: number;
  kind:
    | "SCAN"
    | "ARMED"
    | "ORDER"
    | "FILL"
    | "HOLD"
    | "CLOSING"
    | "ORACLE"
    | "RESULT"
    | "CLAIM"
    | "REARM"
    | "INFO";
  label: string;
  detail?: string;
}

export interface LiveLap {
  number: number;
  market: MarketWindow;
  phase: LapPhase;
  phaseStartedAt: number;
  /** ms elapsed inside the current window (for the countdown ring) */
  windowElapsedMs: number;
  windowTotalMs: number;
  countdownMs: number;
  position: Position | null;
  order: OrderRecord | null;
  fill: FillRecord | null;
  /** live underlying price */
  price: number;
  /** live UP-probability implied by the model */
  probUp: number;
  events: LapEvent[];
}

/* ── results ────────────────────────────────────────────────── */

export interface LapResult {
  lap: number;
  outcome: LapOutcome;
  side: Side;
  asset: AssetId;
  stake: number;
  entryPrice: number;
  closePrice: number;
  openPrice: number;
  pnl: number;
  streakBefore: number;
  streakAfter: number;
  shieldUsed: boolean;
  bankrollBefore: number;
  bankrollAfter: number;
  nextMarket: MarketWindow | null;
  proof: Proof;
  at: number;
}

/* ── arena / social ─────────────────────────────────────────── */

export interface ArenaRunner {
  rank: number;
  runnerId: string;
  name: string;
  ownerHandle: string;
  strategy: string;
  bias: Bias;
  streak: number;
  bestStreak: number;
  pnl7d: number;
  pnlLifetime: number;
  winRate: number; // 0..1
  laps: number;
  followers: number;
  boosters: number;
  status: "RUNNING" | "PAUSED";
  /** rank movement in the last refresh (−2 = up two) */
  delta: number;
  verified: boolean;
  isYou?: boolean;
  glyph: RunnerGlyph;
  spark: number[]; // 12-point bankroll spark
  /** On-chain owner; omitted only when unknown. Never synthesize. */
  ownerAddress?: string;
  cadence?: WindowCadence;
  assets?: AssetId[];
}

export interface RunnerGlyph {
  hue: number; // 0..360 for the avatar palette
  shape: number; // 0..3 avatar motif
}

export interface BoostRelationship {
  runnerId: string;
  runnerName: string;
  amount: number;
  boostedAt: number;
  mirroredRunnerId: string;
}

/* ── notifications ──────────────────────────────────────────── */

export type NotificationKind =
  | "DEPLOY"
  | "FILL"
  | "WIN"
  | "LOSS"
  | "VOID"
  | "STREAK"
  | "SHIELD"
  | "CLAIM"
  | "BOOST"
  | "ARENA"
  | "INFO";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: number;
  read: boolean;
  lap?: number;
}

/* ── analytics ──────────────────────────────────────────────── */

export interface AssetPerformance {
  asset: AssetId;
  laps: number;
  wins: number;
  pnl: number;
  winRate: number;
}

export interface CadencePerformance {
  cadence: WindowCadence;
  laps: number;
  pnl: number;
  winRate: number;
}

export interface RiskMetrics {
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeLike: number; // mean/stdev of lap pnl
  expectedPerLap: number;
  realizedPerLap: number;
  calibration: number; // realized vs expected
  currentStreakRisk: number; // stake at risk on next lap
}

export interface BankrollPoint {
  at: number;
  bankroll: number;
  lap: number;
}

/* ── navigation (SPA) ───────────────────────────────────────── */

export type AppScreen =
  | "home"
  | "deploy"
  | "live"
  | "result"
  | "arena"
  | "runner"
  | "history"
  | "analytics"
  | "notifications"
  | "settings";

export type RelayView = "landing" | "app";

export interface DemoState {
  panelOpen: boolean;
  speed: number; // 1 | 2 | 4 | 8
  forcedOutcome: "win" | "loss" | "void" | null;
  paused: boolean;
}
