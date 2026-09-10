import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Address } from "viem";
import { DEFAULT_SHANNON_RPC, SHANNON_ADDRESSES } from "./addresses.js";
import { createExchange } from "./exchange.js";
import { envString, loadEnv } from "./env.js";
import { getBinaryBookParamsHttp, getMarketOnchainHttp } from "./onchain.js";
import { shannonClient } from "./rpc.js";
import { humanFeedPrice, scaleOracleNumeric } from "./oraclePrice.js";

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
  openPrice: number | null;
  closePrice: number | null;
  livePrice: number | null;
  priceHistory: { t: number; p: number }[];
  oracleQuestionId: string | null;
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
  const slice = live.slice(0, limit);
  const ids = slice.map((m) => m.marketId).filter(Boolean) as string[];
  const [opening, resolution, btcFeed, ethFeed, btcCandles, ethCandles] = await Promise.all([
    ids.length
      ? exchange.client.getOpeningPrices(ids).catch(() => ({}) as Record<string, string | null>)
      : ({} as Record<string, string | null>),
    ids.length
      ? exchange.client.getResolutionPrices(ids).catch(() => ({}) as Record<string, string | null>)
      : ({} as Record<string, string | null>),
    exchange.client.fetchPriceFeedInfo("BTC").catch(() => null),
    exchange.client.fetchPriceFeedInfo("ETH").catch(() => null),
    exchange.client.fetchPriceCandles("BTC", "M1", { limit: 60 }).catch(() => []),
    exchange.client.fetchPriceCandles("ETH", "M1", { limit: 60 }).catch(() => []),
  ]);
  const feedPrice = {
    BTC: humanFeedPrice(btcFeed?.latest?.price),
    ETH: humanFeedPrice(ethFeed?.latest?.price),
  };
  const feedHistory = {
    BTC: btcCandles.map((c) => ({ t: c.bucketStart * 1000, p: c.close })),
    ETH: ethCandles.map((c) => ({ t: c.bucketStart * 1000, p: c.close })),
  };
  const rows: HarnessRow[] = [];

  for (const m of slice) {
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
    const id = m.marketId.toLowerCase();
    const asset = (m.asset ?? "").toUpperCase() === "ETH" ? "ETH" : "BTC";
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
      openPrice: scaleOracleNumeric(opening[id] ?? opening[m.marketId]),
      closePrice: scaleOracleNumeric(resolution[id] ?? resolution[m.marketId]),
      livePrice: feedPrice[asset],
      priceHistory: feedHistory[asset],
      oracleQuestionId:
        onchain.oracleQuestionId && onchain.oracleQuestionId !== 0n
          ? onchain.oracleQuestionId.toString()
          : null,
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
