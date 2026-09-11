import { describe, expect, it } from "vitest";
import {
  assetMatches,
  intervalMatches,
  isFreshWindow,
  normalizeExpireNs,
  rankLivePicks,
  remainingSecFromExpire,
} from "./discover.js";

describe("discover helpers", () => {
  it("matches indexer interval as string or number", () => {
    expect(intervalMatches("60", "60")).toBe(true);
    expect(intervalMatches(60, "60")).toBe(true);
    expect(intervalMatches("300", "60")).toBe(false);
    expect(intervalMatches("60", "900")).toBe(false);
    expect(intervalMatches("900", "900")).toBe(true);
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

  it("treats ≥85% remaining of a 900s window as fresh and rejects a 7m leftover", () => {
    expect(isFreshWindow(840, 900)).toBe(true);
    expect(isFreshWindow(765, 900)).toBe(true);
    expect(isFreshWindow(445, 900)).toBe(false);
    expect(isFreshWindow(540, 900, 0.4)).toBe(true);
    expect(intervalMatches("60", "900")).toBe(false);
    expect(intervalMatches("300", "900")).toBe(false);
  });

  it("ranks a fresh 15m ahead of a mid-window leftover of the same interval", () => {
    const now = 1_000_000_000_000_000_000n;
    const sec = 1_000_000_000n;
    const dying = { expireNs: now + 445n * sec, intervalSec: "900" };
    const fresh = { expireNs: now + 840n * sec, intervalSec: "900" };
    expect([dying, fresh].sort((a, b) => rankLivePicks(a, b, now))[0]).toEqual(fresh);
    expect(remainingSecFromExpire(dying.expireNs, now)).toBe(445);
  });

  it("among two leftovers, prefers the one with more remaining, not the soonest close", () => {
    const now = 1_000_000_000_000_000_000n;
    const sec = 1_000_000_000n;
    const seven = { expireNs: now + 420n * sec, intervalSec: "900" };
    const ten = { expireNs: now + 600n * sec, intervalSec: "900" };
    expect([seven, ten].sort((a, b) => rankLivePicks(a, b, now))[0]).toEqual(ten);
  });
});
