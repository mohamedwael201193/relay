import { describe, expect, it } from "vitest";
import { LAP_SETTLED_TOPIC0, proofTxFromAddressLogs, settlementProofHash } from "./settle.js";

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

describe("proofTxFromAddressLogs", () => {
  const market = "0x0000000000000000000000000000000000000000000000000000000000019dbe";
  const other = "0x0000000000000000000000000000000000000000000000000000000000019d64";
  const hash = `0x${"7f".repeat(32)}`;

  it("picks LapSettled for the market and ignores other topics", () => {
    expect(
      proofTxFromAddressLogs(
        [
          { topics: [`0x${"aa".repeat(32)}`, market], transaction_hash: `0x${"11".repeat(32)}` },
          { topics: [LAP_SETTLED_TOPIC0, other], transaction_hash: `0x${"22".repeat(32)}` },
          { topics: [LAP_SETTLED_TOPIC0, market], transaction_hash: hash },
        ],
        market,
      ),
    ).toBe(hash);
  });

  it("does not invent a hash when LapSettled is missing", () => {
    expect(proofTxFromAddressLogs([{ topics: [LAP_SETTLED_TOPIC0, other], transaction_hash: hash }], market)).toBeNull();
  });
});
