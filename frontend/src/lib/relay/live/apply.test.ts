import { describe, expect, it } from "vitest";
import { assetFromMarket, lapsFromHistory, sideFromKind, streakFromHistory } from "./apply";
import type { HistoryLap, LiveMarketRow, ProofBundle } from "../api/client";

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
  });
});

describe("sideFromKind", () => {
  it("maps BUY_YES to UP and BUY_NO to DOWN", () => {
    expect(sideFromKind("BUY_YES")).toBe("UP");
    expect(sideFromKind("BUY_NO")).toBe("DOWN");
  });
});
