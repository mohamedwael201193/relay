import { describe, expect, it } from "vitest";
import { settlementProofHash } from "./settle.js";

const HASH = `0x${"11".repeat(32)}`;
const HASH2 = `0x${"22".repeat(32)}`;

describe("settlementProofHash", () => {
  it("prefers redeem, then LapSettled/sync, then the last real poke hash", () => {
    expect(settlementProofHash({ redeemTx: HASH, syncVaultTx: HASH2 })).toBe(HASH);
    expect(settlementProofHash({ redeemTx: null, syncVaultTx: HASH2 })).toBe(HASH2);
    expect(
      settlementProofHash({
        redeemTx: null,
        syncVaultTx: null,
        pokeAndSyncTxs: [
          { hash: HASH },
          { hash: "skipped_reactivity" },
        ],
      }),
    ).toBe(HASH);
  });

  it("returns null when a 0-payout loss left no chain hash", () => {
    expect(
      settlementProofHash({
        redeemTx: null,
        syncVaultTx: null,
        pokeAndSyncTxs: [{ hash: "skipped_reactivity" }],
      }),
    ).toBeNull();
  });
});
