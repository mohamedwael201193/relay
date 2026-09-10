import { describe, expect, it } from "vitest";
import { expectedFairPerLap, summarizeTape } from "./analytics";
import type { Lap } from "./types";

function lap(partial: Partial<Lap> & Pick<Lap, "number" | "outcome" | "pnl" | "stake" | "entryPrice">): Lap {
  return {
    market: {
      asset: "ETH",
      label: "ETH",
      marketId: "0x1",
      windowStart: 0,
      windowEnd: 0,
      openPrice: 0,
      closePrice: 0,
      cadence: "1m",
    },
    side: "UP",
    marketOutcome: "UP",
    streakAfter: 0,
    shielded: false,
    settledAt: 0,
    order: {
      id: "o",
      kind: "IOC",
      side: "UP",
      price: partial.entryPrice,
      quantity: 1,
      stake: partial.stake,
      placedAt: 0,
      status: "FILLED",
      tx: { hash: "0x", block: 0, at: 0 },
      latencyMs: 0,
    },
    fill: {
      id: "f",
      orderId: "o",
      price: partial.entryPrice,
      quantity: 1,
      filledAt: 0,
      tx: { hash: "0x", block: 0, at: 0 },
    },
    proof: {
      marketId: "0x1",
      lap: partial.number,
      fillTx: "0x",
      settlementTx: "",
      claimTx: "",
      oracleQuestionId: "",
      status: "PENDING",
      sealedAt: 0,
    },
    ...partial,
  };
}

describe("summarizeTape", () => {
  it("gold: 3W 2L 1V 1 open → 60% / 40% n=5", () => {
    const stats = summarizeTape([
      lap({ number: 1, outcome: "WIN", pnl: 1, stake: 1.5, entryPrice: 0.5 }),
      lap({ number: 2, outcome: "WIN", pnl: 1, stake: 1.5, entryPrice: 0.5 }),
      lap({ number: 3, outcome: "WIN", pnl: 1, stake: 1.5, entryPrice: 0.5 }),
      lap({ number: 4, outcome: "LOSS", pnl: -1.5, stake: 1.5, entryPrice: 0.5 }),
      lap({ number: 5, outcome: "LOSS", pnl: -1.5, stake: 1.5, entryPrice: 0.5 }),
      lap({ number: 6, outcome: "VOID", pnl: 0, stake: 1.5, entryPrice: 0.5 }),
      lap({ number: 7, outcome: "OPEN", pnl: 0, stake: 1.5, entryPrice: 0.5 }),
    ]);
    expect(stats.winRate).toBe(0.6);
    expect(stats.lossRate).toBe(0.4);
    expect(stats.sampleN).toBe(5);
    expect(stats.open).toBe(1);
    expect(stats.netPnl).toBe(0);
  });

  it("empty is dash, not zero", () => {
    const stats = summarizeTape([]);
    expect(stats.winRate).toBeNull();
    expect(stats.netPnl).toBeNull();
    expect(stats.averageRealizedReturn).toBeNull();
  });
});

describe("expectedFairPerLap", () => {
  it("is ~0 at a 50¢ entry", () => {
    const e = expectedFairPerLap([
      lap({ number: 1, outcome: "OPEN", pnl: 0, stake: 1.5, entryPrice: 0.5 }),
    ]);
    expect(e).not.toBeNull();
    expect(Math.abs(e!)).toBeLessThan(1e-9);
  });
});
