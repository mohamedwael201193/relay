import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, shortestPath } from "./state.js";

describe("runner state machine", () => {
  it("allows fill to settlement to redeem", () => {
    expect(canTransition("FILLED", "WAITING_SETTLEMENT")).toBe(true);
    expect(canTransition("WAITING_SETTLEMENT", "SETTLED_WIN")).toBe(true);
    expect(canTransition("SETTLED_WIN", "REDEEMING")).toBe(true);
    expect(canTransition("REDEEMING", "REDEEMED")).toBe(true);
    expect(canTransition("REDEEMED", "REARMING")).toBe(true);
  });

  it("blocks operator-like skip from CREATED to REDEEMED", () => {
    expect(canTransition("CREATED", "REDEEMED")).toBe(false);
    expect(() => assertTransition("KILLED", "ACTIVE")).toThrow();
  });

  it("walks win settle and post-loss re-arm without skipping kill", () => {
    expect(shortestPath("WAITING_SETTLEMENT", "REDEEMED")).toEqual(["SETTLED_WIN", "REDEEMING", "REDEEMED"]);
    expect(shortestPath("SETTLED_LOSS", "DISCOVERING")).toEqual(["REARMING", "DISCOVERING"]);
    expect(shortestPath("FUNDED", "DISCOVERING")).toEqual(["ACTIVE", "DISCOVERING"]);
    expect(shortestPath("FILLED", "KILLED")).toEqual(["KILLED"]);
    expect(shortestPath("FILLED", "DISCOVERING")).toEqual(["REARMING", "DISCOVERING"]);
    expect(canTransition("ERROR", "PAUSED")).toBe(true);
    expect(shortestPath("ERROR", "PAUSED")).toEqual(["PAUSED"]);
  });
});
