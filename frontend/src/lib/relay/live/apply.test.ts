import { describe, expect, it } from "vitest";
import { assetFromMarket, lapsFromHistory, notificationsFromLaps, sideFromKind, streakFromHistory } from "./apply";
import type { HistoryLap, LiveMarketRow, ProofBundle } from "../api/client";
import type { Lap } from "../types";

describe("streakFromHistory", () => {
  it("counts consecutive wins and keeps the run across voids", () => {
    const streak = streakFromHistory([
      { id: "1", lap_index: 1, market_id: "0x1", pool: null, state: "SETTLED_WIN", correlation_id: null, created_at: "" },
      { id: "2", lap_index: 2, market_id: "0x2", pool: null, state: "SETTLED_VOID", correlation_id: null, created_at: "" },
      { id: "3", lap_index: 3, market_id: "0x3", pool: null, state: "SETTLED_WIN", correlation_id: null, created_at: "" },
      { id: "4", lap_index: 4, market_id: "0x4", pool: null, state: "SETTLED_LOSS", correlation_id: null, created_at: "" },
      { id: "5", lap_index: 5, market_id: "0x5", pool: null, state: "SETTLED_WIN", correlation_id: null, created_at: "" },
    ]);
    expect(streak).toEqual({ current: 1, best: 2 });
  });
});

describe("assetFromMarket", () => {
  const ethMarket: LiveMarketRow = {
    marketId: "0xabc",
    asset: "ETH",
    intervalSec: "60",
    onchainStatus: "Trading",
    pool: "0x1",
  };

  it("uses the persisted lap asset", () => {
    expect(assetFromMarket("0xabc", { asset: "ETH" }, [])).toBe("ETH");
  });

  it("falls back to the live market row when history has no asset", () => {
    expect(assetFromMarket("0xABC", {}, [ethMarket])).toBe("ETH");
  });

  it("does not invent ETH when nothing is known", () => {
    expect(assetFromMarket("0xdead", {}, [])).toBe("BTC");
  });
});

describe("lapsFromHistory", () => {
  const history: HistoryLap[] = [
    {
      id: "1",
      lap_index: 1,
      market_id: "0xeth",
      pool: null,
      state: "FILLED",
      correlation_id: null,
      created_at: "2026-09-10T08:00:00.000Z",
      asset: "ETH",
      interval_sec: "60",
    },
  ];
  const proof: ProofBundle = {
    orders: [
      {
        tx_hash: "0xfill",
        fill_class: "FILL",
        filled: "1000",
        market_id: "0xeth",
        lap_index: 1,
        created_at: "2026-09-10T08:00:00.000Z",
        price: "77000",
        quantity: "1000",
      },
    ],
    settlements: [],
    records: [],
  };

  it("keeps ETH and OPEN instead of forcing BTC or a loss", () => {
    const laps = lapsFromHistory(history, proof, []);
    expect(laps).toHaveLength(1);
    expect(laps[0].market.asset).toBe("ETH");
    expect(laps[0].side).toBe("UP");
    expect(laps[0].outcome).toBe("OPEN");
    expect(laps[0].market.cadence).toBe("1m");
    expect(laps[0].pnl).toBe(0);
  });

  it("uses persisted pnl on settled laps and keeps OPEN out of win rate inputs", () => {
    const settled: HistoryLap[] = [
      { ...history[0], state: "SETTLED_WIN", pnl: "250" },
    ];
    const withSettle: ProofBundle = {
      ...proof,
      settlements: [
        {
          market_id: "0xeth",
          resolved: true,
          voided: false,
          redeem_tx: "0xredeem",
          created_at: "2026-09-10T08:05:00.000Z",
          lap_index: 1,
        },
      ],
    };
    const laps = lapsFromHistory(settled, withSettle, []);
    expect(laps[0].outcome).toBe("WIN");
    expect(laps[0].pnl).toBe(250 / 1e6);
    expect(laps[0].streakAfter).toBe(1);
    expect(laps[0].proof.status).toBe("VERIFIED");
  });
});

describe("sideFromKind", () => {
  it("maps BUY_YES to UP and BUY_NO to DOWN", () => {
    expect(sideFromKind("BUY_YES")).toBe("UP");
    expect(sideFromKind("BUY_NO")).toBe("DOWN");
  });
});

function tapeLap(partial: Pick<Lap, "number" | "outcome" | "pnl"> & Partial<Lap>): Lap {
  return {
    market: {
      asset: "ETH",
      label: "ETH Up or Down",
      marketId: "0x1",
      windowStart: 0,
      windowEnd: 0,
      openPrice: 0,
      closePrice: 0,
      cadence: "1m",
    },
    side: "UP",
    stake: 1,
    entryPrice: 0.5,
    marketOutcome: "UP",
    streakAfter: 0,
    shielded: false,
    settledAt: 1,
    order: {
      id: "o",
      kind: "IOC",
      side: "UP",
      price: 0.5,
      quantity: 1,
      stake: 1,
      placedAt: 0,
      status: "FILLED",
      tx: { hash: "0x", block: 0, at: 0 },
      latencyMs: 0,
    },
    fill: {
      id: "f",
      orderId: "o",
      price: 0.5,
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

describe("notificationsFromLaps", () => {
  it("emits WIN/LOSS/VOID for new settled laps and skips OPEN", () => {
    const prev = [tapeLap({ number: 1, outcome: "OPEN", pnl: 0 })];
    const next = [
      tapeLap({ number: 1, outcome: "WIN", pnl: 0.4, streakAfter: 1 }),
      tapeLap({ number: 2, outcome: "OPEN", pnl: 0 }),
      tapeLap({ number: 3, outcome: "VOID", pnl: 0 }),
    ];
    const notes = notificationsFromLaps(prev, next);
    expect(notes.map((n) => n.kind)).toEqual(["WIN", "VOID"]);
    expect(notes[0].lap).toBe(1);
    expect(notes[0].title).toContain("complete");
  });

  it("does not re-notify an already settled outcome", () => {
    const win = tapeLap({ number: 1, outcome: "WIN", pnl: 0.4, streakAfter: 1 });
    expect(notificationsFromLaps([win], [win])).toEqual([]);
  });
});
