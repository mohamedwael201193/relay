import { describe, expect, it } from "vitest";
import { ownerBoundReset } from "./ownerSession";

describe("ownerBoundReset", () => {
  it("drops tape, result overlay, alerts, and vault so a second wallet cannot inherit them", () => {
    const patch = ownerBoundReset();
    expect(patch.vaultAddress).toBeNull();
    expect(patch.laps).toEqual([]);
    expect(patch.lastResult).toBeNull();
    expect(patch.resultOpen).toBe(false);
    expect(patch.notifications).toEqual([]);
    expect(patch.liveLap).toBeNull();
    expect(patch.bankroll).toBe(0);
    expect(patch.startBankroll).toBe(0);
    expect(patch.following).toEqual([]);
  });
});
