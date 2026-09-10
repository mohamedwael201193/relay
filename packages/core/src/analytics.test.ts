import { describe, expect, it } from "vitest";
import {
  aggregateArena,
  attachBoostCounts,
  expectedFairPnl,
  streakFromLapStates,
  streakFromOutcomes,
  summarizeLaps,
} from "./analytics.js";
import { boostConfigHash } from "./vaultOps.js";

describe("summarizeLaps", () => {
  it("gold: 3 wins, 2 losses, 1 void, 1 open → 60% / 40% with n=5", () => {
    const stats = summarizeLaps([
      { outcome: "WIN", pnl: 1, stake: 1.5, entryPrice: 0.5, settledAt: 1 },
      { outcome: "WIN", pnl: 1, stake: 1.5, entryPrice: 0.5, settledAt: 2 },
      { outcome: "WIN", pnl: 1, stake: 1.5, entryPrice: 0.5, settledAt: 3 },
      { outcome: "LOSS", pnl: -1.5, stake: 1.5, entryPrice: 0.5, settledAt: 4 },
      { outcome: "LOSS", pnl: -1.5, stake: 1.5, entryPrice: 0.5, settledAt: 5 },
      { outcome: "VOID", pnl: 0, stake: 1.5, entryPrice: 0.5, settledAt: 6 },
      { outcome: "OPEN", pnl: 0, stake: 1.5, entryPrice: 0.5, settledAt: 7 },
    ]);
    expect(stats.wins).toBe(3);
    expect(stats.losses).toBe(2);
    expect(stats.voids).toBe(1);
    expect(stats.open).toBe(1);
    expect(stats.decided).toBe(5);
    expect(stats.sampleN).toBe(5);
    expect(stats.winRate).toBe(0.6);
    expect(stats.lossRate).toBe(0.4);
    expect(stats.netPnl).toBe(0);
  });

  it("empty tape is null rates, not 0%", () => {
    const stats = summarizeLaps([]);
    expect(stats.winRate).toBeNull();
    expect(stats.lossRate).toBeNull();
    expect(stats.netPnl).toBeNull();
    expect(stats.sampleN).toBe(0);
  });
});

describe("streakFromOutcomes", () => {
  it("voids keep the run; open is ignored", () => {
    expect(streakFromOutcomes(["WIN", "VOID", "WIN", "OPEN", "LOSS", "WIN"])).toEqual({
      current: 1,
      best: 2,
    });
  });

  it("shielded losses keep the run", () => {
    expect(
      streakFromOutcomes([
        { outcome: "WIN" },
        { outcome: "WIN" },
        { outcome: "LOSS", shielded: true },
        { outcome: "WIN" },
      ]),
    ).toEqual({ current: 3, best: 3 });
  });
});

describe("streakFromLapStates", () => {
  it("counts REDEEMED as a win so the next stake compounds", () => {
    expect(
      streakFromLapStates([
        { state: "REDEEMED" },
        { state: "WAITING_SETTLEMENT" },
      ]),
    ).toBe(1);
    expect(
      streakFromLapStates([{ state: "SETTLED_WIN" }, { state: "REDEEMED" }]),
    ).toBe(2);
  });
});

describe("expectedFairPnl", () => {
  it("is ~0 at a 50¢ entry", () => {
    const e = expectedFairPnl([{ outcome: "OPEN", pnl: 0, stake: 1.5, entryPrice: 0.5, settledAt: 1 }]);
    expect(e).not.toBeNull();
    expect(Math.abs(e!)).toBeLessThan(1e-9);
  });
});

describe("aggregateArena", () => {
  it("does not invent followers and ranks by pnl_raw", () => {
    const rows = aggregateArena([
      { vault: "0xa", owner: "0x1", state: "ACTIVE", lap_state: "SETTLED_WIN", pnl: "1000", created_at: new Date().toISOString() },
      { vault: "0xb", owner: "0x2", state: "ACTIVE", lap_state: "SETTLED_LOSS", pnl: "-500", created_at: new Date().toISOString() },
      { vault: "0xc", owner: "0x3", state: "ACTIVE", lap_state: null, pnl: null },
    ]);
    expect(rows[0].vault).toBe("0xa");
    expect(rows[0].wins).toBe(1);
    expect(rows[0].win_rate).toBe(1);
    expect(rows[2].vault).toBe("0xc");
    expect(rows[2].win_rate).toBeNull();
    expect(rows[2].verified_laps).toBe(0);
    expect(rows[0].bias).toBe("FOLLOW");
    expect(rows[0].interval_sec).toBe("60");
  });

  it("attaches on-chain boost counts without inventing missing leaders", () => {
    const rows = attachBoostCounts(
      [{ vault: "0xAa" }, { vault: "0xbb" }],
      { "0xaa": 3 },
    );
    expect(rows[0].boosters).toBe(3);
    expect(rows[1].boosters).toBe(0);
  });
});

describe("boostConfigHash", () => {
  it("is deterministic for the cloned policy", () => {
    const a = boostConfigHash("FOLLOW", "900", ["BTC", "ETH"]);
    const b = boostConfigHash("FOLLOW", "900", ["BTC", "ETH"]);
    const c = boostConfigHash("UP", "900", ["BTC", "ETH"]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith("0x")).toBe(true);
    expect(a.length).toBe(66);
  });
});
