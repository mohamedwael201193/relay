import { describe, expect, it } from "vitest";
import {
  derivedPnlRaw,
  filledOrderNeedsSettle,
  settlementIsFinal,
  shouldWaitForReactivity,
  voidExpiredIsCallable,
} from "./settleGate.js";

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

  it("is false after a resolved or voided settlement on the same market with a proof tx", () => {
    const proof = "0x" + "ab".repeat(32);
    expect(
      filledOrderNeedsSettle(
        { fill_class: "PARTIAL_FILL", market_id: "0xa" },
        { market_id: "0xa", resolved: true, voided: false, redeem_tx: proof },
      ),
    ).toBe(false);
    expect(
      filledOrderNeedsSettle(
        { fill_class: "FILL", market_id: "0xa" },
        { market_id: "0xa", resolved: false, voided: true, redeem_tx: proof },
      ),
    ).toBe(false);
  });

  it("retries when the market is final but the claim/settle hash was never stored", () => {
    expect(
      filledOrderNeedsSettle(
        { fill_class: "FILL", market_id: "0xa" },
        { market_id: "0xa", resolved: true, voided: false, redeem_tx: null },
      ),
    ).toBe(true);
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

describe("voidExpiredIsCallable", () => {
  it("opens at expiry + settlementWindow inclusive", () => {
    expect(voidExpiredIsCallable(100n, 300n, 399n)).toBe(false);
    expect(voidExpiredIsCallable(100n, 300n, 400n)).toBe(true);
    expect(voidExpiredIsCallable(100n, 300n, 401n)).toBe(true);
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

describe("shouldWaitForReactivity", () => {
  const marketId = "0x000000000000000000000000000000000000000000000000000000000001957d";
  const base = {
    marketTerminal: true,
    subscribed: true,
    armedActive: true,
    armedMarketId: marketId,
    marketId,
    alreadyWaited: false,
  };

  it("waits one tick when the vault is subscribed and still armed", () => {
    expect(shouldWaitForReactivity(base)).toBe(true);
  });

  it("does not wait after the callback consumed the arm, or after the recovery tick", () => {
    expect(shouldWaitForReactivity({ ...base, armedActive: false })).toBe(false);
    expect(shouldWaitForReactivity({ ...base, alreadyWaited: true })).toBe(false);
    expect(shouldWaitForReactivity({ ...base, subscribed: false })).toBe(false);
    expect(shouldWaitForReactivity({ ...base, marketTerminal: false })).toBe(false);
  });
});
