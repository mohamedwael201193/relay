/**
 * RELAY — simulation engine (mock layer).
 * ─────────────────────────────────
 * A deterministic phase machine that turns market windows into laps:
 * SCAN → ARMED → ORDER → FILL → HOLD → CLOSING → ORACLE → RESULT → CLAIM → REARM
 *
 * Deterministic per lap number (seeded RNG) so demo recordings replay
 * identically. Replace this module with the DreamDEX SDK + Somnia
 * Reactivity event stream in the integration phase — the store API
 * stays identical.
 */

import type {
  BookLevel,
  BookSnapshot,
  LapPhase,
  MarketWindow,
  AssetId,
  WindowCadence,
} from "../types";
import { ASSET_META } from "../mock/dataset";
import { marketId, rng, gauss } from "../mock/id";
import { CLOSING_FRACTION, ENTRY_ZONE_MS, PHASE_DURATIONS, WINDOW_SIM_MS } from "./phaseTimings";

export { PHASE_DURATIONS, WINDOW_SIM_MS, ENTRY_ZONE_MS, CLOSING_FRACTION };

export const PHASE_ORDER: LapPhase[] = [
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

/* ── market window factory ──────────────────────────────────── */

export function createWindow(
  lapNumber: number,
  opensAt: number,
  cadence: WindowCadence = "15m"
): MarketWindow {
  const asset: AssetId = lapNumber % 3 === 0 ? "ETH" : "BTC";
  const r = rng(lapNumber * 77003);
  const meta = ASSET_META[asset];
  const openPrice = +(meta.base * (1 + (r() - 0.5) * 0.008)).toFixed(
    asset === "BTC" ? 1 : 2
  );
  return {
    id: `win-${lapNumber}`,
    marketId: marketId(`live${lapNumber}-${asset}`),
    asset,
    label: `${asset} Up or Down`,
    cadence,
    openPrice,
    opensAt,
    closesAt: opensAt + WINDOW_SIM_MS,
    venue: "DreamDEX · Event Contracts",
    collateral: "tUSDC",
    live: true,
  };
}

/** Rolling market calendar for tickers / "next windows" surfaces. */
export function calendarFrom(lapNumber: number, current: MarketWindow, count: number) {
  const out: MarketWindow[] = [];
  let n = lapNumber + 1;
  let opens = current.closesAt;
  for (let i = 0; i < count; i++) {
    out.push(createWindow(n, opens));
    opens += WINDOW_SIM_MS + 2_000;
    n += 1;
  }
  return out;
}

/* ── outcome scripting ──────────────────────────────────────── */

export interface ScriptedOutcome {
  win: boolean;
  isVoid: boolean;
  targetFactor: number; // close = open × factor
}

export function scriptOutcome(
  lapNumber: number,
  forced: "win" | "loss" | "void" | null,
  currentStreak: number
): ScriptedOutcome {
  const r = rng(lapNumber * 104729);
  if (forced === "void") return { win: false, isVoid: true, targetFactor: 1.0001 };
  if (forced === "win") return { win: true, isVoid: false, targetFactor: 1 + mag(r) };
  if (forced === "loss") return { win: false, isVoid: false, targetFactor: 1 - mag(r) };
  // house model: ~0.62 win rate with a mild hot-hand ease-off
  const p = 0.62 - Math.min(currentStreak, 10) * 0.006;
  const win = r() < p;
  return { win, isVoid: false, targetFactor: win ? 1 + mag(r) : 1 - mag(r) };
}

function mag(r: () => number) {
  return 0.0008 + r() * 0.0024;
}

/* ── price & probability model ──────────────────────────────── */

export function priceTick(
  price: number,
  asset: AssetId,
  dtMs: number,
  seed: number
): number {
  const meta = ASSET_META[asset];
  const dt = dtMs / 1000;
  const step = gauss(rng(seed)) * meta.vol * Math.sqrt(Math.max(dt, 0.05));
  return Math.max(price * 0.9, price * (1 + step));
}

export function steer(
  price: number,
  target: number,
  strength = 0.08
): number {
  return price + (target - price) * strength;
}

/** Implied UP probability from price position & time remaining. */
export function probUp(price: number, open: number, remainingFrac: number): number {
  const z = price / open - 1;
  const p = 0.5 + 0.5 * Math.tanh(z * 160 * (0.25 + remainingFrac));
  return Math.min(0.95, Math.max(0.05, p));
}

/* ── order book ─────────────────────────────────────────────── */

export function buildBook(prob: number, seed: number): BookSnapshot {
  const r = rng(seed);
  const mk = (center: number, dir: -1 | 1): BookLevel[] =>
    Array.from({ length: 5 }, (_, i) => ({
      price: +Math.min(0.98, Math.max(0.02, center + dir * (0.006 + i * 0.012))).toFixed(3),
      size: Math.round(30 + r() * 420),
    }));
  const p = +prob.toFixed(3);
  return {
    bidUp: mk(p - 0.002, -1),
    askUp: mk(p + 0.002, 1),
    bidDown: mk(1 - p - 0.002, -1).map((l) => ({ ...l, price: +Math.min(0.98, Math.max(0.02, 1 - p - 0.002 - (0.006))).toFixed(3) })),
    askDown: mk(1 - p + 0.002, 1),
    spread: 0.012,
  };
}

/* ── sizing ─────────────────────────────────────────────────── */

export function stakeFor(
  bankroll: number,
  streak: number,
  basePct: number,
  multiplier: number,
  maxPct: number
): number {
  const base = bankroll * basePct;
  const compounded = base * (1 + multiplier * streak);
  const cap = bankroll * maxPct;
  return Math.max(1, +Math.min(compounded, cap).toFixed(2));
}

/** Entry price with the runner's post-only edge (3¢ inside fair). */
export function entryWithEdge(fairProb: number, side: "UP" | "DOWN"): number {
  const sideFair = side === "UP" ? fairProb : 1 - fairProb;
  return +Math.min(0.95, Math.max(0.05, sideFair - 0.03)).toFixed(3);
}
