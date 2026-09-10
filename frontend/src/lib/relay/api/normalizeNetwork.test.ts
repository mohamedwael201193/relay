import { describe, expect, it } from "vitest";
import { SHANNON_PUBLIC } from "../config/network";
import { normalizeNetwork } from "./normalizeNetwork";

describe("normalizeNetwork", () => {
  it("fills legacy singleton payloads from public Shannon config", () => {
    const net = normalizeNetwork({
      chainId: 50312,
      decimals: 6,
      vault: SHANNON_PUBLIC.opsVault,
      mainnetTradingEnabled: false,
    });
    expect(net.collateral).toBe(SHANNON_PUBLIC.collateral);
    expect(net.opsVault).toBe(SHANNON_PUBLIC.opsVault);
    expect(net.mainnetTradingEnabled).toBe(false);
  });

  it("rejects mainnet trading", () => {
    expect(() => normalizeNetwork({ chainId: 50312, mainnetTradingEnabled: true })).toThrow(/mainnet/);
  });

  it("rejects a non-Shannon chain id", () => {
    expect(() => normalizeNetwork({ chainId: 5031, mainnetTradingEnabled: false })).toThrow(/chainId/);
  });
});
