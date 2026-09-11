import { describe, expect, it } from "vitest";
import { deriveVisualPhase, interpolatePhaseHistory, remainingMs, windowBounds } from "./activeLap";

describe("interpolatePhaseHistory", () => {
  it("fills CLOSE and ORACLE when the client hops HOLD → RESULT", () => {
    expect(interpolatePhaseHistory("RESULT", ["SCAN", "ARMED", "ORDER", "FILL", "HOLD"], true)).toEqual([
      "SCAN",
      "ARMED",
      "ORDER",
      "FILL",
      "HOLD",
      "CLOSING",
      "ORACLE",
      "RESULT",
    ]);
  });

  it("resets on a new lap", () => {
    expect(interpolatePhaseHistory("ORDER", ["HOLD", "CLOSING"], false)).toEqual([
      "SCAN",
      "ARMED",
      "ORDER",
    ]);
  });
});

describe("deriveVisualPhase", () => {
  it("stays HOLD before close and becomes CLOSING after", () => {
    const closesAt = 1_000_000;
    expect(
      deriveVisualPhase({
        backendState: "WAITING_SETTLEMENT",
        verifiedFill: true,
        now: closesAt - 5_000,
        closesAt,
        lastError: "settlement_pending",
        hasOracleAnswer: false,
      }),
    ).toBe("HOLD");
    expect(
      deriveVisualPhase({
        backendState: "WAITING_SETTLEMENT",
        verifiedFill: true,
        now: closesAt + 1_000,
        closesAt,
        lastError: "settlement_pending",
        hasOracleAnswer: false,
      }),
    ).toBe("CLOSING");
    expect(
      deriveVisualPhase({
        backendState: "WAITING_SETTLEMENT",
        verifiedFill: true,
        now: closesAt + 1_000,
        closesAt,
        lastError: "waiting_reactivity",
        hasOracleAnswer: true,
      }),
    ).toBe("ORACLE");
  });
});

describe("windowBounds", () => {
  it("derives open from expiry − interval, not from now", () => {
    const bounds = windowBounds({
      intervalMs: 900_000,
      expirySec: 1_800,
      now: 999_999_000,
    });
    expect(bounds.closesAt).toBe(1_800_000);
    expect(bounds.opensAt).toBe(900_000);
  });
});

describe("remainingMs", () => {
  it("returns NaN when close time is unknown", () => {
    expect(Number.isNaN(remainingMs(0, 1))).toBe(true);
  });
});
