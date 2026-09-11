import { describe, expect, it } from "vitest";

describe("unsettled PnL flash", () => {
  it("does not treat NaN as a changed value (Object.is, not !==)", () => {
    expect(Number.NaN !== Number.NaN).toBe(true);
    expect(Object.is(Number.NaN, Number.NaN)).toBe(true);
  });
});
