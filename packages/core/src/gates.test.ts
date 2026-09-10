import { describe, expect, it } from "vitest";
import { assertShannonExecution } from "./gates.js";
import { canTransition, RUNNER_STATES } from "./state.js";

describe("mainnet gate", () => {
  it("refuses MAINNET_TRADING_ENABLED", () => {
    const prevNet = process.env.RELAY_NETWORK;
    const prevFlag = process.env.MAINNET_TRADING_ENABLED;
    try {
      process.env.RELAY_NETWORK = "shannon";
      process.env.MAINNET_TRADING_ENABLED = "true";
      expect(() => assertShannonExecution()).toThrow(/MAINNET_TRADING_ENABLED/);
      process.env.RELAY_NETWORK = "mainnet";
      process.env.MAINNET_TRADING_ENABLED = "false";
      expect(() => assertShannonExecution()).toThrow(/gated/);
    } finally {
      process.env.RELAY_NETWORK = prevNet;
      process.env.MAINNET_TRADING_ENABLED = prevFlag;
    }
  });
});

describe("state machine exhaustive illegal jumps", () => {
  it("KILLED is terminal except identity", () => {
    for (const to of RUNNER_STATES) {
      if (to === "KILLED") continue;
      expect(canTransition("KILLED", to)).toBe(false);
    }
  });
});
