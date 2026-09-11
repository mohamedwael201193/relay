import { describe, expect, it } from "vitest";
import { clock, countdown, money, signed } from "./format";

describe("money empty vs zero", () => {
  it("renders unknown as an em dash, not $0.00", () => {
    expect(money(Number.NaN)).toBe("—");
    expect(signed(Number.NaN)).toBe("—");
  });

  it("renders a real zero as $0.00, not eight dust decimals", () => {
    expect(money(0)).toBe("$0.00");
    expect(signed(0)).toBe("+$0.00");
    expect(signed(-4e-10)).toBe("+$0.00");
  });

  it("does not render epoch zero as 02:00:00", () => {
    expect(clock(0)).toBe("—");
    expect(clock(Number.NaN)).toBe("—");
  });

  it("floors countdown seconds so the label never skips", () => {
    expect(countdown(9_000)).toBe("00:09");
    expect(countdown(8_999)).toBe("00:08");
    expect(countdown(Number.NaN)).toBe("—");
  });
});
