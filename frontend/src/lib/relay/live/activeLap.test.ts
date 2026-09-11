import { describe, expect, it } from "vitest";
import {
  deriveVisualPhase,
  holdBackendState,
  interpolatePhaseHistory,
  isNewSettledResult,
  joinHint,
  measuredCloseToSettleMs,
  nextEligibleWindow,
  oracleWaitView,
  remainingMs,
  settleHoldLapIndex,
  tickLiveLapClock,
  windowBounds,
} from "./activeLap";

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

  it("fills CLAIM when the client hops RESULT → REARM", () => {
    expect(
      interpolatePhaseHistory("REARM", ["SCAN", "ARMED", "ORDER", "FILL", "HOLD", "CLOSING", "ORACLE", "RESULT"], true),
    ).toEqual(["SCAN", "ARMED", "ORDER", "FILL", "HOLD", "CLOSING", "ORACLE", "RESULT", "CLAIM", "REARM"]);
  });
});

describe("deriveVisualPhase", () => {
  it("stays HOLD before close and becomes ORACLE after, interpolating CLOSE in history", () => {
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
    ).toBe("ORACLE");
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

describe("settleHoldLapIndex", () => {
  it("holds the settled lap when overlay is open and N+1 has already started", () => {
    expect(
      settleHoldLapIndex({ overlayOpen: true, lastSettledLap: 11, currentLapIndex: 12 }),
    ).toBe(11);
  });

  it("does not hold after KEEP WATCHING or when still on the settled lap", () => {
    expect(
      settleHoldLapIndex({ overlayOpen: false, lastSettledLap: 11, currentLapIndex: 12 }),
    ).toBeNull();
    expect(
      settleHoldLapIndex({ overlayOpen: true, lastSettledLap: 11, currentLapIndex: 11 }),
    ).toBeNull();
  });
});

describe("isNewSettledResult", () => {
  it("fires when the settled lap was OPEN on the previous tape even if N+1 is already FILLED", () => {
    expect(
      isNewSettledResult(
        [
          { number: 11, outcome: "OPEN" },
          { number: 12, outcome: "OPEN" },
        ],
        11,
      ),
    ).toBe(true);
    expect(isNewSettledResult([{ number: 11, outcome: "LOSS" }], 11)).toBe(false);
  });
});

describe("holdBackendState", () => {
  it("maps any settled outcome + next-lap-started to REARMING so CLAIM/RE-ARM stay on the stepper", () => {
    expect(holdBackendState("SETTLED_LOSS", true)).toBe("REARMING");
    expect(holdBackendState("SETTLED_WIN", true)).toBe("REARMING");
    expect(holdBackendState("SETTLED_VOID", true)).toBe("REARMING");
    expect(holdBackendState("REDEEMED", true)).toBe("REARMING");
    expect(holdBackendState("REDEEMING", true)).toBe("REDEEMING");
    expect(holdBackendState("SETTLED_LOSS", false)).toBe("SETTLED_LOSS");
  });
});

describe("oracleWaitView", () => {
  it("marks DELAYED after 30s without an answer and never calls that FAILED", () => {
    const closesAt = 1_000_000;
    const waiting = oracleWaitView({
      now: closesAt + 3_000,
      closesAt,
      hasOracleAnswer: false,
      lastError: "settlement_pending",
      questionId: "53984",
      host: "dev.oracle.somnia.host",
    });
    expect(waiting.status).toBe("waiting_answer");
    expect(waiting.delayed).toBe(false);
    expect(waiting.closedAgoMs).toBe(3_000);
    const delayed = oracleWaitView({
      now: closesAt + 42_000,
      closesAt,
      hasOracleAnswer: false,
      lastError: "settlement_pending",
      questionId: "53984",
      host: "dev.oracle.somnia.host",
    });
    expect(delayed.delayed).toBe(true);
    expect(delayed.status).toBe("waiting_answer");
  });
});

describe("nextEligibleWindow", () => {
  it("waits for the next open instead of joining a 15m already 7 minutes in", () => {
    const now = 1_000_000;
    const hint = nextEligibleWindow(
      [
        { opensAt: now - 450_000, closesAt: now + 450_000, cadence: "15m" },
        { opensAt: now + 450_000, closesAt: now + 1_350_000, cadence: "15m" },
      ],
      "15m",
      now,
    );
    expect(hint?.kind).toBe("opens");
    expect(hint?.startsAt).toBe(now + 450_000);
    expect(hint?.remainingMs).toBe(450_000);
  });
});

describe("tickLiveLapClock", () => {
  it("promotes HOLD to ORACLE the tick now crosses closeAt, and keeps elapsed wait honest", () => {
    const closesAt = 10_000;
    const hold = {
      phase: "HOLD" as const,
      previousPhase: "FILL" as const,
      phaseHistory: ["SCAN", "ARMED", "ORDER", "FILL", "HOLD"] as ("SCAN" | "ARMED" | "ORDER" | "FILL" | "HOLD")[],
      events: [{ id: "ev-HOLD", at: 1, kind: "HOLD", label: "POSITION LIVE" }],
      market: { opensAt: 1_000, closesAt },
      windowTotalMs: 9_000,
      countdownMs: 500,
      windowElapsedMs: 8_500,
      oracleWait: null as null,
    };
    const stillOpen = tickLiveLapClock({ ...hold }, closesAt - 1);
    expect(stillOpen.phase).toBe("HOLD");
    expect(stillOpen.countdownMs).toBe(1);
    const closed = tickLiveLapClock({ ...hold }, closesAt);
    expect(closed.phase).toBe("ORACLE");
    expect(closed.countdownMs).toBe(0);
    expect(closed.phaseHistory).toEqual(expect.arrayContaining(["HOLD", "CLOSING", "ORACLE"]));
    expect(closed.oracleWait?.status).toBe("waiting_answer");
    expect(closed.oracleWait?.closedAgoMs).toBe(0);
    const later = tickLiveLapClock(closed, closesAt + 42_000);
    expect(later.phase).toBe("ORACLE");
    expect(later.oracleWait?.delayed).toBe(true);
    expect(later.oracleWait?.closedAgoMs).toBe(42_000);
  });
});

describe("joinHint / measuredCloseToSettleMs", () => {
  it("only surfaces JOINED AT when fill is after open, and never reports 0ms as a measured settle", () => {
    expect(joinHint(1_000, 1_005)).toBeNull();
    expect(joinHint(1_000, 20_000)?.joinedAt).toBe(20_000);
    expect(measuredCloseToSettleMs(1_000, null)).toBeNull();
    expect(measuredCloseToSettleMs(1_000, 4_000)).toBe(3_000);
  });
});
