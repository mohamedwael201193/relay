import { describe, expect, it } from "vitest";
import { pickOwnedVault, selectDeployVault } from "./pickOwnedVault";

const B = "0x1506f2177769ecb8fa4903160c896e68f5d15747";
const OPS = "0xd762a7719f0e991413038276a37abf7a417d4d59";
const SCRIPT_B = "0x8a4f6d7364adabecc460f16243462b7741648695";

describe("pickOwnedVault", () => {
  it("returns null for Wallet C (empty list) even if the store still holds Wallet B", () => {
    expect(pickOwnedVault([], B)).toBeNull();
    expect(pickOwnedVault([], OPS)).toBeNull();
  });

  it("does not use a hint that the owner does not list", () => {
    expect(pickOwnedVault([{ vault: B, state: "STOPPED" }], OPS)).toBe(B);
  });

  it("uses the owner's listed vault when the hint matches", () => {
    expect(pickOwnedVault([{ vault: B, state: "STOPPED" }], B)).toBe(B);
  });

  it("prefers a live vault over a killed leftover hint", () => {
    expect(
      pickOwnedVault(
        [
          { vault: SCRIPT_B, state: "KILLED" },
          { vault: B, state: "STOPPED" },
        ],
        SCRIPT_B,
      ),
    ).toBe(B);
  });

  it("keeps a killed owned vault when that is all the owner has (withdraw)", () => {
    expect(pickOwnedVault([{ vault: B, state: "KILLED" }], B)).toBe(B);
  });

  it("prefers ACTIVE over a STOPPED leftover hint for the same owner", () => {
    const next = "0x427f68e6f19b43ea108711edef7b1d9074af8887";
    expect(
      pickOwnedVault(
        [
          { vault: B, state: "STOPPED" },
          { vault: next, state: "ACTIVE" },
        ],
        B,
      ),
    ).toBe(next);
  });

  it("does not bind a new ACTIVE child while a sibling lap is still in flight", () => {
    const parent = "0xca3972699b1776b78557aa3b561d3be4c764702a";
    const child = "0xead6aee211048699a74b7a16c917634842a7b6b7";
    expect(
      pickOwnedVault(
        [
          { vault: child, state: "ACTIVE" },
          { vault: parent, state: "WAITING_SETTLEMENT" },
        ],
        child,
      ),
    ).toBe(parent);
  });
});

describe("selectDeployVault", () => {
  it("does not reuse a STOPPED or on-chain-killed vault for deposit", () => {
    expect(selectDeployVault([{ vault: B, state: "STOPPED" }])).toBeNull();
    expect(selectDeployVault([{ vault: B, state: "ORDER_SUBMITTED" }], { [B]: true })).toBeNull();
  });

  it("reuses a live vault that is not killed on-chain", () => {
    expect(selectDeployVault([{ vault: B, state: "WAITING_MARKET" }], { [B]: false })).toBe(B);
  });
});
