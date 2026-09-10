import { describe, expect, it } from "vitest";
import { intervalMatches, normalizeExpireNs } from "./discover.js";

describe("discover helpers", () => {
  it("matches indexer interval as string or number", () => {
    expect(intervalMatches("60", "60")).toBe(true);
    expect(intervalMatches(60, "60")).toBe(true);
    expect(intervalMatches("300", "60")).toBe(false);
    expect(intervalMatches(undefined, undefined)).toBe(true);
  });

  it("uses pool ns when present and lifts module seconds to ns", () => {
    expect(normalizeExpireNs(1_789_003_500_000_000_000n, 1789003500n)).toBe(1_789_003_500_000_000_000n);
    expect(normalizeExpireNs(0n, 1789003500n)).toBe(1_789_003_500_000_000_000n);
    expect(normalizeExpireNs(0n, 0n)).toBe(0n);
  });
});
