import { describe, expect, it } from "vitest";
import { classifyFill, snapDown, snapQuantity } from "./quant.js";

describe("quant", () => {
  it("snaps price down to tick 1000", () => {
    expect(snapDown(5500n, 1000n)).toBe(5000n);
    expect(snapDown(5000n, 1000n)).toBe(5000n);
  });

  it("raises quantity to min lot", () => {
    expect(snapQuantity(1n, 1000n, 1000n)).toBe(1000n);
    expect(snapQuantity(2500n, 1000n, 1000n)).toBe(2000n);
  });

  it("does not treat receipt success as fill", () => {
    expect(classifyFill(1000n, 0n, true)).toBe("NO_FILL");
    expect(classifyFill(1000n, 400n, true)).toBe("PARTIAL_FILL");
    expect(classifyFill(1000n, 1000n, true)).toBe("FILL");
    expect(classifyFill(1000n, 0n, false)).toBe("UNKNOWN");
  });
});
