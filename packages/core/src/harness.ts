import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Address } from "viem";
import { DEFAULT_SHANNON_RPC, SHANNON_ADDRESSES } from "./addresses.js";
import { createExchange } from "./exchange.js";
import { envString, loadEnv } from "./env.js";
import { getBinaryBookParamsHttp, getMarketOnchainHttp } from "./onchain.js";
import { shannonClient } from "./rpc.js";

export type HarnessRow = {
  marketId: string;
  indexerStatus: string | undefined;
  venueId: string | undefined;
  asset: string | undefined;
  intervalSec: string | undefined;
  expiry: string | undefined;
  onchainStatus: string;
  pool: string;
  nonce: string;
  decimals: number;
  voidPolicy: number | null;
  tickSize: string;
  lotSize: string;
  minQuantity: string;
  fees: unknown;
  bookLevels: { bids: number; asks: number } | null;
};

export async function runShannonHarness(limit = 5): Promise<{
  generatedAt: string;
  count: number;
  rows: HarnessRow[];
}> {
  loadEnv();
  const exchange = createExchange("shannon");
  const rpc = envString("SOMNIA_SHANNON_RPC_URL", DEFAULT_SHANNON_RPC)!;
  const sh = shannonClient(rpc);
  const live = await exchange.client.listLiveBinaryMarkets({ limit: 25 });
  const rows: HarnessRow[] = [];

  for (const m of live.slice(0, limit)) {
    if (!m.marketId || !m.poolAddress) continue;
    const onchain = await getMarketOnchainHttp(
      sh,
      SHANNON_ADDRESSES.binaryModule as Address,
      m.marketId,
    );
    const book = await getBinaryBookParamsHttp(sh, onchain.pool);
    let fees: unknown = null;
    try {
      fees = await exchange.client.getMarketFees(m.marketId);
    } catch {
      fees = { error: "getMarketFees failed" };
    }
    let bookLevels: { bids: number; asks: number } | null = null;
    try {
      const ob = await exchange.client.getBinaryOrderBook(m.poolAddress);
      bookLevels = {
        bids: ob.yesBids?.length ?? 0,
        asks: ob.yesAsks?.length ?? 0,
      };
    } catch {
      bookLevels = null;
    }
    rows.push({
      marketId: m.marketId,
      indexerStatus: m.status,
      venueId: m.venueId ?? undefined,
      asset: m.asset ?? undefined,
      intervalSec: m.intervalSec ?? undefined,
      expiry: String(m.expiry ?? onchain.expiry),
      onchainStatus: onchain.statusLabel,
      pool: onchain.pool,
      nonce: onchain.nonce.toString(),
      decimals: onchain.decimals,
      voidPolicy: onchain.voidPolicy,
      tickSize: book.tickSize.toString(),
      lotSize: book.lotSize.toString(),
      minQuantity: book.minQuantity.toString(),
      fees,
      bookLevels,
    });
  }

  const out = { generatedAt: new Date().toISOString(), count: rows.length, rows };
  mkdirSync(resolve(process.cwd(), "docs/evidence"), { recursive: true });
  writeFileSync(
    resolve(process.cwd(), "docs/evidence/harness-shannon.json"),
    JSON.stringify(out, null, 2),
  );
  return out;
}
