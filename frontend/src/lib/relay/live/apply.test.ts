import { describe, expect, it } from "vitest";
import { streakFromHistory } from "./apply";

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
