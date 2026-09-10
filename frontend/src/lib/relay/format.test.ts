import { describe, expect, it } from "vitest";
import { money, signed } from "./format";

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
});
