import { describe, expect, it } from "vitest";
import { humanFeedPrice, scaleOracleNumeric } from "./oraclePrice.js";

describe("scaleOracleNumeric", () => {
  it("scales live Shannon BTC/ETH indexer integers by 2 d.p.", () => {
    expect(scaleOracleNumeric("7716507")).toBe(77165.07);
    expect(scaleOracleNumeric("243661")).toBe(2436.61);
  });

  it("scales 1e18 oracle-adapter values", () => {
    expect(scaleOracleNumeric("1000000000000000000")).toBe(1);
  });

  it("passes through already-human feed prices", () => {
    expect(scaleOracleNumeric(77165.07)).toBe(77165.07);
    expect(humanFeedPrice(2436.61)).toBe(2436.61);
  });

  it("does not invent a price from empty or non-positive input", () => {
    expect(scaleOracleNumeric(null)).toBeNull();
    expect(scaleOracleNumeric("")).toBeNull();
    expect(scaleOracleNumeric("0")).toBeNull();
    expect(humanFeedPrice(0)).toBeNull();
    expect(humanFeedPrice(-1)).toBeNull();
  });
});
