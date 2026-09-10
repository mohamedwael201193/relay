import { describe, expect, it } from "vitest";
import { assetMatches, intervalMatches, normalizeExpireNs } from "./discover.js";

describe("discover helpers", () => {
  it("matches indexer interval as string or number", () => {
    expect(intervalMatches("60", "60")).toBe(true);
    expect(intervalMatches(60, "60")).toBe(true);
    expect(intervalMatches("300", "60")).toBe(false);
    expect(intervalMatches(undefined, undefined)).toBe(true);
  });

  it("skips missing assets only when the filter list is non-empty", () => {
    expect(assetMatches("BTC", undefined)).toBe(true);
    expect(assetMatches("BTC", [])).toBe(true);
    expect(assetMatches("ETH", ["BTC", "ETH"])).toBe(true);
    expect(assetMatches("btc", ["BTC"])).toBe(true);
    expect(assetMatches("SOL", ["BTC", "ETH"])).toBe(false);
    expect(assetMatches(undefined, ["BTC"])).toBe(false);
  });

  it("uses pool ns when present and lifts module seconds to ns", () => {
    expect(normalizeExpireNs(1_789_003_500_000_000_000n, 1789003500n)).toBe(1_789_003_500_000_000_000n);
    expect(normalizeExpireNs(0n, 1789003500n)).toBe(1_789_003_500_000_000_000n);
    expect(normalizeExpireNs(0n, 0n)).toBe(0n);
  });
});
