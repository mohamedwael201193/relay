import { describe, expect, it } from "vitest";
import { somniaCreateGas, SOMNIA_CODE_GAS_PER_BYTE } from "./sendHttp.js";

describe("somniaCreateGas", () => {
  it("uses official 3125 gas/byte and never returns the 10M order cap", () => {
    const tenKb = `0x${"ab".repeat(10_000)}` as `0x${string}`;
    const gas = somniaCreateGas(tenKb);
    expect(SOMNIA_CODE_GAS_PER_BYTE).toBe(3125n);
    expect(gas).toBeGreaterThan(10_000_000n);
    expect(gas).toBeGreaterThanOrEqual(8_000_000n + 3125n * 10_000n + 25_000_000n);
  });

  it("floors tiny contracts at 40M", () => {
    expect(somniaCreateGas("0x")).toBe(40_000_000n);
  });
});
