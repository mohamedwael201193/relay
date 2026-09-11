import { describe, expect, it } from "vitest";
import { verifyTape } from "./verifyTape.js";

describe("verifyTape", () => {
  it("flags open zero PnL and missing fills; accepts a matching win", () => {
    const report = verifyTape([
      {
        lap_index: 1,
        state: "REDEEMED",
        fill_class: "FILL",
        fill_tx: "0xabc",
        redeem_tx: "0xdef",
        entry_cost: "1500000",
        redeem_value: "1646000",
        pnl: "146000",
      },
      {
        lap_index: 2,
        state: "WAITING_SETTLEMENT",
        fill_class: "FILL",
        pnl: "0",
      },
      {
        lap_index: 3,
        state: "SETTLED_LOSS",
        fill_class: "UNKNOWN",
        entry_cost: "1000",
        redeem_value: "0",
        pnl: "-1000",
      },
    ]);
    expect(report.stats.wins).toBe(1);
    expect(report.stats.winRate).toBe(0.5);
    expect(report.flags.map((f) => f.code).sort()).toEqual(["missing_verified_fill", "open_zero_pnl"]);
    expect(report.ok).toBe(false);
  });

  it("is clean when fills and PnL reconcile", () => {
    const report = verifyTape([
      {
        lap_index: 1,
        state: "SETTLED_LOSS",
        fill_class: "FILL",
        fill_tx: "0x1",
        redeem_tx: "0x2",
        entry_cost: "599256",
        redeem_value: "0",
        pnl: "-599256",
        shielded: true,
      },
      {
        lap_index: 2,
        state: "REDEEMED",
        fill_class: "FILL",
        fill_tx: "0x3",
        redeem_tx: "0x4",
        entry_cost: "596286",
        redeem_value: "633000",
        pnl: "36714",
      },
    ]);
    expect(report.ok).toBe(true);
    expect(report.stats.wins).toBe(1);
    expect(report.stats.losses).toBe(1);
    expect(report.streak.current).toBe(1);
  });
});
