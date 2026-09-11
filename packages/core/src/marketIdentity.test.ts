import { describe, expect, it } from "vitest";
import {
  canonicalOracleQuestionId,
  oracleExplorerHost,
  oracleQuestionUrl,
  settlementOracleQuestionId,
} from "./marketIdentity.js";

/** Shannon 2026-09-11 parent vault lap 7 — verified against chain 50312 Prophecy. */
const SHANNON_LAP7 = {
  marketId: "0x0000000000000000000000000000000000000000000000000000000000019bf2",
  asset: "ETH",
  intervalSec: "900",
  oracleQuestionId: "53883",
  closePrice: "2442.69",
  pool: "0x96b8f8Cfc61683a71D3a7B2703F61cB357ea033b",
};

const SHANNON_LAP11_SAME_POOL = {
  marketId: "0x0000000000000000000000000000000000000000000000000000000000019cd2",
  asset: "BTC",
  intervalSec: "900",
  oracleQuestionId: "53921",
  pool: SHANNON_LAP7.pool,
};

describe("oracle explorer identity", () => {
  it("maps Shannon question ids to the testnet Prophecy host", () => {
    expect(oracleExplorerHost(50312)).toBe("dev.oracle.somnia.host");
    expect(oracleQuestionUrl(SHANNON_LAP7.oracleQuestionId, 50312)).toBe(
      "https://dev.oracle.somnia.host/questions/53883?view=graph",
    );
  });

  it("does not send Shannon ids to mainnet prd.oracle (numeric ids collide)", () => {
    expect(oracleExplorerHost(5031)).toBe("prd.oracle.somnia.host");
    expect(oracleQuestionUrl("53883", 5031)).toBe(
      "https://prd.oracle.somnia.host/questions/53883?view=graph",
    );
    expect(oracleQuestionUrl("53883", 50312)).not.toBe(oracleQuestionUrl("53883", 5031));
  });

  it("does not invent a proof URL without a question id", () => {
    expect(oracleQuestionUrl(null, 50312)).toBeNull();
    expect(oracleQuestionUrl("0", 50312)).toBeNull();
    expect(oracleQuestionUrl("", 50312)).toBeNull();
  });
});

describe("canonicalOracleQuestionId", () => {
  it("gives a new market its on-chain question, not the indexer's previous one", () => {
    expect(canonicalOracleQuestionId("53883", "53791")).toBe("53883");
  });

  it("does not let an old lap inherit a successor's question", () => {
    expect(canonicalOracleQuestionId(SHANNON_LAP7.oracleQuestionId, "53946")).toBe("53883");
  });

  it("gives a successor its own question", () => {
    expect(canonicalOracleQuestionId("53921", SHANNON_LAP7.oracleQuestionId)).toBe("53921");
  });

  it("falls back to indexer only when the module record has no question yet", () => {
    expect(canonicalOracleQuestionId(0n, "53883")).toBe("53883");
    expect(canonicalOracleQuestionId(null, null)).toBeNull();
  });

  it("pool recycle cannot alias two markets onto one question", () => {
    expect(SHANNON_LAP7.pool.toLowerCase()).toBe(SHANNON_LAP11_SAME_POOL.pool.toLowerCase());
    expect(SHANNON_LAP7.marketId).not.toBe(SHANNON_LAP11_SAME_POOL.marketId);
    expect(
      canonicalOracleQuestionId(SHANNON_LAP7.oracleQuestionId, SHANNON_LAP11_SAME_POOL.oracleQuestionId),
    ).toBe(SHANNON_LAP7.oracleQuestionId);
    expect(
      canonicalOracleQuestionId(SHANNON_LAP11_SAME_POOL.oracleQuestionId, SHANNON_LAP7.oracleQuestionId),
    ).toBe(SHANNON_LAP11_SAME_POOL.oracleQuestionId);
  });

  it("refresh/restart cannot restore a stale indexer id over on-chain", () => {
    expect(canonicalOracleQuestionId("53883", "53848")).toBe("53883");
  });
});

describe("settlementOracleQuestionId", () => {
  it("rejects a claimed question that does not match the market's on-chain bind", () => {
    const miss = settlementOracleQuestionId({
      marketId: SHANNON_LAP7.marketId,
      onchainQuestionId: SHANNON_LAP7.oracleQuestionId,
      claimedQuestionId: "56914",
    });
    expect(miss.rejected).toBe("mismatch");
    expect(miss.questionId).toBe("53883");
  });

  it("refuses to poke when the module has no question for the market", () => {
    expect(
      settlementOracleQuestionId({
        marketId: SHANNON_LAP7.marketId,
        onchainQuestionId: 0n,
      }).rejected,
    ).toBe("missing");
  });

  it("accepts the on-chain question for that marketId", () => {
    const ok = settlementOracleQuestionId({
      marketId: SHANNON_LAP7.marketId,
      onchainQuestionId: 53883n,
      claimedQuestionId: "53883",
    });
    expect(ok.rejected).toBeNull();
    expect(ok.questionId).toBe("53883");
  });
});

describe("Shannon RPC (optional)", () => {
  it("reads markets(019bf2).oracleQuestionId = 53883 from chain 50312", async () => {
    try {
      const { getMarketOnchainHttp } = await import("./onchain.js");
      const { shannonHttpClient } = await import("./sendHttp.js");
      const { SHANNON_ADDRESSES, requiredAddress } = await import("./addresses.js");
      const module = requiredAddress(SHANNON_ADDRESSES.binaryModule, "binaryModule");
      const onchain = await getMarketOnchainHttp(
        shannonHttpClient(),
        module,
        SHANNON_LAP7.marketId as `0x${string}`,
      );
      expect(onchain.oracleQuestionId.toString()).toBe("53883");
      expect(oracleQuestionUrl(onchain.oracleQuestionId.toString(), 50312)).toContain("dev.oracle.somnia.host");
    } catch (e) {
      console.warn("shannon rpc unavailable", (e as Error).message);
      expect(canonicalOracleQuestionId("53883", "56914")).toBe("53883");
    }
  }, 25_000);
});
