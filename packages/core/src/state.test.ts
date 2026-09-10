import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "./state.js";

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
});
