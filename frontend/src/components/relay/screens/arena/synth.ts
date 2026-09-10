/**
 * RELAY — deterministic social synthesis for the Arena & Runner Profile.
 *
 * Other runners' public detail (boost ticker chatter, lap tape, streak
 * history) is DERIVED from the live arena array with a local seeded rng
 * so every demo replay is identical. Production live mode does not use
 * this chatter.
 * Nothing here randomizes on paint; numbers re-derive only when the
 * arena itself changes (rank/pnl updates) or the sim clock advances.
 */

import type { ArenaRunner } from "@/lib/relay/types";

function rng(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable numeric seed for an arbitrary string id. */
export function seedFor(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** URL slug for a runner's public card, e.g. "Night Shift" → "night-shift". */
export function slugFor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ── live boost ticker ──────────────────────────────────────── */

export interface TickerItem {
  id: string;
  /** lead-in, e.g. "@kosto boosted" */
  pre: string;
  /** the highlighted token, e.g. "Pheidippides" or "#4" */
  hot: string;
  /** trailing detail, e.g. " · $25.00" */
  post: string;
  tone: "lime" | "flame" | "ember";
}

const BOOST_AMOUNTS = [10, 25, 50];

/** Seeded chatter derived from the arena; re-derives when ranks move. */
export function tickerItems(arena: ArenaRunner[]): TickerItem[] {
  const runners = arena.filter((a) => !a.isYou);
  if (runners.length < 2) return [];
  return runners.map((a, i) => {
    const r = rng(seedFor(`${a.runnerId}:${a.rank}`));
    let j = Math.floor(r() * runners.length);
    if (j === i) j = (j + 1) % runners.length; // no self-boosts
    const fan = runners[j];
    const roll = r();
    if (roll < 0.42) {
      const amt = BOOST_AMOUNTS[Math.floor(r() * BOOST_AMOUNTS.length)];
      return {
        id: `${a.runnerId}-boost`,
        pre: `${fan.ownerHandle} boosted`,
        hot: a.name,
        post: ` · $${amt.toFixed(2)}`,
        tone: "flame" as const,
      };
    }
    if (roll < 0.64) {
      return {
        id: `${a.runnerId}-follow`,
        pre: `${fan.ownerHandle} followed`,
        hot: a.name,
        post: " · new mirror watch",
        tone: "lime" as const,
      };
    }
    if (roll < 0.82) {
      return {
        id: `${a.runnerId}-climb`,
        pre: `${a.ownerHandle} climbed to`,
        hot: `#${a.rank}`,
        post: " · 7d verified",
        tone: "lime" as const,
      };
    }
    return {
      id: `${a.runnerId}-streak`,
      pre: `${a.name} streak`,
      hot: `×${a.streak}`,
      post: " · fills on tape",
      tone: "flame" as const,
    };
  });
}

/* ── other runners' lap tape (derived from public fills) ────── */

export type TapeOutcome = "WIN" | "LOSS" | "VOID";

export interface TapeRow {
  lap: number;
  asset: "BTC" | "ETH";
  side: "UP" | "DOWN";
  entry: number;
  outcome: TapeOutcome;
  pnl: number;
  at: number;
}

/** One settled lap ≈ one 15m window (sim clock). */
const WINDOW_MS = 15 * 60 * 1000;

/**
 * 12 tape rows consistent with the runner's winRate: stakes near $8–$12,
 * wins pay stake×(1/entry−1) at entries ≈ 55–62¢, losses cost the stake.
 */
export function synthTape(a: ArenaRunner, now: number): TapeRow[] {
  const r = rng(seedFor(`tape:${a.runnerId}:${a.laps}`));
  const rows: TapeRow[] = [];
  for (let i = 0; i < 12; i++) {
    const stake = 8 + r() * 4;
    const entry = 0.55 + r() * 0.07;
    const roll = r();
    const outcome: TapeOutcome =
      roll < 0.03 ? "VOID" : roll < 0.03 + a.winRate * 0.97 ? "WIN" : "LOSS";
    const pnl =
      outcome === "WIN"
        ? +(stake * (1 / entry - 1)).toFixed(2)
        : outcome === "LOSS"
          ? -+stake.toFixed(2)
          : 0;
    rows.push({
      lap: a.laps - i,
      asset: r() < 0.62 ? "BTC" : "ETH",
      side:
        a.bias === "DOWN"
          ? r() < 0.7
            ? "DOWN"
            : "UP"
          : r() < 0.7
            ? "UP"
            : "DOWN",
      entry: +entry.toFixed(3),
      outcome,
      pnl,
      at: now - Math.round((i + 0.6 + r() * 0.5) * WINDOW_MS),
    });
  }
  return rows;
}

/* ── streak history ticks ───────────────────────────────────── */

export type Tick = "W" | "L" | "V";

/** Outcome ticks for another runner, matching their winRate + current streak. */
export function synthTicks(a: ArenaRunner, count = 18): Tick[] {
  const r = rng(seedFor(`ticks:${a.runnerId}:${a.laps}`));
  const ticks: Tick[] = [];
  for (let i = 0; i < count; i++) {
    const roll = r();
    ticks.push(roll < 0.035 ? "V" : roll < 0.035 + a.winRate * 0.965 ? "W" : "L");
  }
  // the current streak is live — show it at the tail of the strip
  if (a.streak > 0) {
    const n = Math.min(a.streak, count - 1);
    for (let i = 0; i < n; i++) ticks[count - 1 - i] = "W";
  }
  return ticks;
}

/** Real ticks from the user's settled laps (oldest → newest). Unsettled OPEN fills are not decided. */
export function ticksFromLaps(
  laps: { outcome: "WIN" | "LOSS" | "VOID" | "OPEN" }[],
  count = 18
): Tick[] {
  return laps
    .filter((l) => l.outcome !== "OPEN")
    .slice(-count)
    .map((l) => (l.outcome === "WIN" ? "W" : l.outcome === "LOSS" ? "L" : "V"));
}

/** Longest consecutive win run and where it starts. */
export function longestWinRange(ticks: Tick[]): { start: number; length: number } {
  let best = { start: 0, length: 0 };
  let cur = 0;
  for (let i = 0; i < ticks.length; i++) {
    if (ticks[i] === "W") {
      cur++;
      if (cur > best.length) best = { start: i - cur + 1, length: cur };
    } else {
      cur = 0;
    }
  }
  return best;
}

/** Best-guess shield count for another runner, from their streak. */
export function shieldsGuess(streak: number): number {
  return Math.min(3, Math.floor(streak / 5));
}
