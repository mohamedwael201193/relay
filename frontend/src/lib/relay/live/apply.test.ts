import { describe, expect, it } from "vitest";
import { assetFromMarket, bookSnapshotFromLive, lapsFromHistory, liveFeedPrice, liveLapFromState, notificationsFromLaps, sideFromKind, streakFromHistory } from "./apply";
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

  it("does not break the run on a shielded loss", () => {
    const streak = streakFromHistory([
      { id: "1", lap_index: 1, market_id: "0x1", pool: null, state: "SETTLED_WIN", correlation_id: null, created_at: "" },
      {
        id: "2",
        lap_index: 2,
        market_id: "0x2",
        pool: null,
        state: "SETTLED_LOSS",
        correlation_id: null,
        created_at: "",
        shielded: true,
      },
      { id: "3", lap_index: 3, market_id: "0x3", pool: null, state: "SETTLED_WIN", correlation_id: null, created_at: "" },
    ]);
    expect(streak).toEqual({ current: 2, best: 2 });
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

  it("uses persisted open/close prices and oracle question id, never $0 placeholders", () => {
    const settled: HistoryLap[] = [
      {
        ...history[0],
        state: "SETTLED_WIN",
        pnl: "250",
        open_price: "77165.07",
        close_price: "77210.4",
        oracle_question_id: "17539064",
      },
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
    expect(laps[0].market.openPrice).toBe(77165.07);
    expect(laps[0].market.closePrice).toBe(77210.4);
    expect(laps[0].proof.oracleQuestionId).toBe("17539064");
  });

  it("maps REDEEMED to WIN with source-backed PnL instead of treating the lap as OPEN", () => {
    const redeemed: HistoryLap[] = [
      {
        ...history[0],
        state: "REDEEMED",
        entry_cost: "1499506",
        redeem_value: "1646000",
        pnl: "146494",
        open_price: "2466.66",
        close_price: "2472.3",
        oracle_question_id: "53247",
      },
    ];
    const withSettle: ProofBundle = {
      ...proof,
      orders: [{ ...proof.orders[0], kind: "BUY_YES", filled: "1646000", quantity: "1646000", price: "911000" }],
      settlements: [
        {
          market_id: "0xeth",
          resolved: true,
          voided: false,
          payout_numerators: ["10000000", "0"],
          redeem_tx: "0x34a88d1b28f43055bd34c66f9d3e1f66f0b6c23ab0e94977a2b15acd79ceb57b",
          created_at: "2026-09-10T17:20:12.000Z",
          lap_index: 1,
        },
      ],
    };
    const laps = lapsFromHistory(redeemed, withSettle, []);
    expect(laps[0].outcome).toBe("WIN");
    expect(laps[0].marketOutcome).toBe("UP");
    expect(laps[0].pnl).toBeCloseTo(0.146494);
    expect(laps[0].stake).toBeCloseTo(1.499506);
    expect(laps[0].streakAfter).toBe(1);
    expect(laps[0].proof.status).toBe("VERIFIED");
    expect(laps[0].proof.settlementTx).toMatch(/^0x34a88d/);
  });

  it("prices BUY_NO escrow in NO terms, not YES * qty", () => {
    const openNo: HistoryLap[] = [
      {
        id: "2",
        lap_index: 2,
        market_id: "0xbtc",
        pool: null,
        state: "WAITING_SETTLEMENT",
        correlation_id: null,
        created_at: "2026-09-10T17:20:26.000Z",
        asset: "BTC",
        interval_sec: "900",
        entry_cost: "1508290",
      },
    ];
    const withFill: ProofBundle = {
      orders: [
        {
          tx_hash: "0xfill2",
          fill_class: "FILL",
          filled: "2030000",
          market_id: "0xbtc",
          lap_index: 2,
          created_at: "2026-09-10T17:20:26.000Z",
          price: "257000",
          quantity: "2030000",
          kind: "BUY_NO",
        },
      ],
      settlements: [],
      records: [],
    };
    const laps = lapsFromHistory(openNo, withFill, []);
    expect(laps[0].side).toBe("DOWN");
    expect(laps[0].outcome).toBe("OPEN");
    expect(laps[0].entryPrice).toBeCloseTo(0.743);
    expect(laps[0].stake).toBeCloseTo(1.50829);
    expect(laps[0].pnl).toBe(0);
  });
});

describe("streakFromHistory redeemed wins", () => {
  it("counts REDEEMED as a win and does not reset on the next open lap", () => {
    expect(
      streakFromHistory([
        { id: "1", lap_index: 1, market_id: "0x1", pool: null, state: "REDEEMED", correlation_id: null, created_at: "" },
        { id: "2", lap_index: 2, market_id: "0x2", pool: null, state: "WAITING_SETTLEMENT", correlation_id: null, created_at: "" },
      ]),
    ).toEqual({ current: 1, best: 1 });
  });
});

describe("sideFromKind", () => {
  it("maps BUY_YES to UP and BUY_NO to DOWN", () => {
    expect(sideFromKind("BUY_YES")).toBe("UP");
    expect(sideFromKind("BUY_NO")).toBe("DOWN");
    expect(sideFromKind("SELL_NO")).toBe("UP");
    expect(sideFromKind("SELL_YES")).toBe("DOWN");
    expect(sideFromKind(1)).toBe("DOWN");
    expect(sideFromKind(3)).toBe("UP");
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

describe("live feed fallback", () => {
  it("keeps ETH live USD when the filled window has left the live board", () => {
    const markets: LiveMarketRow[] = [
      {
        marketId: "0xother",
        asset: "ETH",
        intervalSec: "60",
        onchainStatus: "Trading",
        pool: "0x1",
        livePrice: 2439.615,
        priceHistory: [
          { t: 1, p: 2438 },
          { t: 2, p: 2439.615 },
        ],
      },
    ];
    expect(liveFeedPrice(markets, "ETH")).toBe(2439.615);
    const lap = liveLapFromState({
      row: {
        id: "r",
        vault: "0xabc",
        owner: "0x1",
        operator: "0x1",
        state: "WAITING_SETTLEMENT",
        chain_id: 50312,
        last_error: null,
        last_market_id: "0xexpired",
        lap_index: 1,
      },
      markets,
      proof: { orders: [], settlements: [], records: [] },
      now: Date.now(),
      history: [
        {
          id: "1",
          lap_index: 1,
          market_id: "0xexpired",
          pool: null,
          state: "FILLED",
          correlation_id: null,
          created_at: "",
          asset: "ETH",
          interval_sec: "60",
          open_price: "2438.89",
        },
      ],
    });
    expect(lap?.market.asset).toBe("ETH");
    expect(lap?.market.openPrice).toBe(2438.89);
    expect(lap?.price).toBe(2439.615);
  });

  it("sizes a BUY_NO hold from complementary escrow, not YES * qty", () => {
    const lap = liveLapFromState({
      row: {
        id: "r",
        vault: "0xabc",
        owner: "0x1",
        operator: "0x1",
        state: "WAITING_SETTLEMENT",
        chain_id: 50312,
        last_error: null,
        last_market_id: "0xbtc",
        lap_index: 2,
      },
      markets: [
        {
          marketId: "0xbtc",
          asset: "BTC",
          intervalSec: "900",
          onchainStatus: "Locked",
          pool: "0x1",
          livePrice: 77204.1,
          openPrice: 77150.21,
        },
      ],
      proof: {
        orders: [
          {
            tx_hash: "0xfill2",
            fill_class: "FILL",
            filled: "2030000",
            market_id: "0xbtc",
            lap_index: 2,
            created_at: "2026-09-10T17:20:26.000Z",
            price: "257000",
            quantity: "2030000",
            kind: "BUY_NO",
          },
        ],
        settlements: [],
        records: [],
      },
      now: Date.now(),
      history: [
        {
          id: "2",
          lap_index: 2,
          market_id: "0xbtc",
          pool: null,
          state: "WAITING_SETTLEMENT",
          correlation_id: null,
          created_at: "2026-09-10T17:20:26.000Z",
          asset: "BTC",
          interval_sec: "900",
          entry_cost: "1508290",
        },
      ],
    });
    expect(lap?.position?.side).toBe("DOWN");
    expect(lap?.position?.stake).toBeCloseTo(1.50829);
    expect(lap?.position?.entryPrice).toBeCloseTo(0.743);
    expect(lap?.order?.stake).toBeCloseTo(1.50829);
  });
});

describe("bookSnapshotFromLive", () => {
  it("maps a DreamDEX 5-level book and does not invent a spread", () => {
    const snap = bookSnapshotFromLive({
      bidUp: [{ price: 0.47, size: 2 }],
      askUp: [{ price: 0.49, size: 1.5 }],
      bidDown: [{ price: 0.51, size: 1.5 }],
      askDown: [{ price: 0.53, size: 2 }],
      spread: 0.02,
    });
    expect(snap.bidUp[0]).toEqual({ price: 0.47, size: 2 });
    expect(snap.spread).toBeCloseTo(0.02);
    expect(bookSnapshotFromLive({ bidUp: [], askUp: [], bidDown: [], askDown: [], spread: null })).toEqual({
      bidUp: [],
      askUp: [],
      bidDown: [],
      askDown: [],
      spread: 0,
    });
  });
});
