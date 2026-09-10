import { describe, expect, it } from "vitest";
import {
  classifyFill,
  collateralCost,
  collateralCostForKind,
  policyStakeRaw,
  quantityForStake,
  snapDown,
  snapQuantity,
} from "./quant.js";

describe("quant", () => {
  it("snaps price down to tick 1000", () => {
    expect(snapDown(5500n, 1000n)).toBe(5000n);
    expect(snapDown(5000n, 1000n)).toBe(5000n);
  });

  it("raises quantity to min lot", () => {
    expect(snapQuantity(1n, 1000n, 1000n)).toBe(1000n);
    expect(snapQuantity(2500n, 1000n, 1000n)).toBe(2000n);
  });

  it("sizes a $1.50 stake at 50¢ to 3 contracts, not min lot", () => {
    const unit = 1_000_000n;
    const price = 500_000n;
    const qty = quantityForStake({
      stake: 1_500_000n,
      price,
      unit,
      lotSize: 1000n,
      minQuantity: 1000n,
      cap: 25_000_000n,
    });
    expect(qty).toBe(3_000_000n);
    expect(collateralCost(price, qty, unit)).toBe(1_500_000n);
  });

  it("refuses a stake smaller than the min-lot escrow", () => {
    expect(() =>
      quantityForStake({
        stake: 10n,
        price: 500_000n,
        unit: 1_000_000n,
        lotSize: 1000n,
        minQuantity: 1000n,
        cap: 25_000_000n,
      }),
    ).toThrow(/below min-lot cost/);
  });

  it("applies 6% base of a $25 vault and λ·n lift under the 10% cap", () => {
    const vault = 25_000_000n;
    expect(policyStakeRaw({ vaultBal: vault, perWindowCap: vault, streak: 0 })).toBe(1_500_000n);
    const n3 = policyStakeRaw({ vaultBal: vault, perWindowCap: vault, streak: 3 });
    expect(n3).toBe(1_905_000n);
    const capped = policyStakeRaw({ vaultBal: vault, perWindowCap: vault, streak: 20 });
    expect(capped).toBe(2_500_000n);
  });

  it("does not treat receipt success as fill", () => {
    expect(classifyFill(1000n, 0n, true)).toBe("NO_FILL");
    expect(classifyFill(1000n, 400n, true)).toBe("PARTIAL_FILL");
    expect(classifyFill(1000n, 1000n, true)).toBe("FILL");
    expect(classifyFill(1000n, 0n, false)).toBe("UNKNOWN");
  });

  it("BUY_NO escrow is ceil(qty * (unit - yesPrice) / unit)", () => {
    const unit = 1_000_000n;
    const yesPrice = 200_000n;
    const qty = 2_000_000n;
    expect(collateralCostForKind(2, yesPrice, qty, unit)).toBe(1_600_000n);
    expect(collateralCostForKind(0, yesPrice, qty, unit)).toBe(400_000n);
    expect(collateralCost(yesPrice, qty, unit)).toBe(400_000n);
  });

  it("sizes BUY_NO against the complementary NO cost, not the YES price", () => {
    const unit = 1_000_000n;
    const yesPrice = 200_000n;
    const qty = quantityForStake({
      stake: 1_600_000n,
      price: yesPrice,
      unit,
      lotSize: 1000n,
      minQuantity: 1000n,
      cap: 25_000_000n,
      kind: 2,
    });
    expect(qty).toBe(2_000_000n);
    expect(collateralCostForKind(2, yesPrice, qty, unit)).toBe(1_600_000n);
  });

  it("SELL_YES and SELL_NO escrow 0 collateral", () => {
    expect(collateralCostForKind(1, 500_000n, 1_000_000n, 1_000_000n)).toBe(0n);
    expect(collateralCostForKind(3, 500_000n, 1_000_000n, 1_000_000n)).toBe(0n);
  });

  it("BUY_NO at 50¢ matches BUY_YES size at the same yes price", () => {
    const unit = 1_000_000n;
    const price = 500_000n;
    const opts = {
      stake: 1_500_000n,
      price,
      unit,
      lotSize: 1000n,
      minQuantity: 1000n,
      cap: 25_000_000n,
    };
    expect(quantityForStake({ ...opts, kind: 2 })).toBe(3_000_000n);
    expect(quantityForStake({ ...opts, kind: 0 })).toBe(3_000_000n);
  });
});
