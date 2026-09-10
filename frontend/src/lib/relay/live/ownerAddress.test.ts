import { describe, expect, it } from "vitest";
import { ownerFromPrivy } from "./ownerAddress";

describe("ownerFromPrivy", () => {
  it("prefers the connected wallet list", () => {
    expect(
      ownerFromPrivy({
        wallets: [{ address: "0x1111111111111111111111111111111111111111" }],
        user: { wallet: { address: "0x2222222222222222222222222222222222222222" } },
      }),
    ).toBe("0x1111111111111111111111111111111111111111");
  });

  it("falls back to linked accounts", () => {
    expect(
      ownerFromPrivy({
        wallets: [],
        user: {
          linkedAccounts: [{ type: "wallet", address: "0x3333333333333333333333333333333333333333" }],
        },
      }),
    ).toBe("0x3333333333333333333333333333333333333333");
  });

  it("ignores non-addresses", () => {
    expect(ownerFromPrivy({ wallets: [{ address: "not-an-address" }], user: null })).toBeUndefined();
  });
});
