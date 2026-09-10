import { describe, expect, it } from "vitest";
import { derivedPnlRaw, filledOrderNeedsSettle, settlementIsFinal } from "./settleGate.js";

describe("filledOrderNeedsSettle", () => {
  it("is false without a fill", () => {
    expect(filledOrderNeedsSettle({ fill_class: "NO_FILL", market_id: "0xa" }, undefined)).toBe(false);
    expect(filledOrderNeedsSettle(undefined, undefined)).toBe(false);
  });

  it("is true for a fill with no settlement row", () => {
    expect(filledOrderNeedsSettle({ fill_class: "FILL", market_id: "0xa" }, undefined)).toBe(true);
  });

  it("is true when a settlement was persisted before the market resolved", () => {
    expect(
      filledOrderNeedsSettle(
        { fill_class: "FILL", market_id: "0xa" },
        { market_id: "0xa", resolved: false, voided: false },
      ),
    ).toBe(true);
  });

  it("is false after a resolved or voided settlement on the same market", () => {
    expect(
      filledOrderNeedsSettle(
        { fill_class: "PARTIAL_FILL", market_id: "0xa" },
        { market_id: "0xa", resolved: true, voided: false },
      ),
    ).toBe(false);
    expect(
      filledOrderNeedsSettle(
        { fill_class: "FILL", market_id: "0xa" },
        { market_id: "0xa", resolved: false, voided: true },
      ),
    ).toBe(false);
  });

  it("is true when the last settlement belongs to a different market", () => {
    expect(
      filledOrderNeedsSettle(
        { fill_class: "FILL", market_id: "0xb" },
        { market_id: "0xa", resolved: true, voided: false },
      ),
    ).toBe(true);
  });
});

describe("settlementIsFinal", () => {
  it("treats voided as final even if resolved is false", () => {
    expect(settlementIsFinal({ resolved: false, voided: true })).toBe(true);
  });
});

describe("derivedPnlRaw", () => {
  it("keeps an explicit pnl", () => {
    expect(derivedPnlRaw("-77", "100", "0")).toBe("-77");
  });

  it("subtracts entry from redeem when pnl is missing", () => {
    expect(derivedPnlRaw(null, "1500000", "0")).toBe("-1500000");
    expect(derivedPnlRaw("", "1500000", "3000000")).toBe("1500000");
  });

  it("does not invent pnl from a partial pair", () => {
    expect(derivedPnlRaw(null, "1500000", null)).toBeNull();
    expect(derivedPnlRaw(null, null, "0")).toBeNull();
  });
});
