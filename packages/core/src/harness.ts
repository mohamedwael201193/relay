import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Address, Hex } from "viem";
import { DEFAULT_SHANNON_RPC, SHANNON_ADDRESSES } from "./addresses.js";
import { humanBinaryBook, type HumanBinaryBook } from "./bookView.js";
import { createExchange } from "./exchange.js";
import { envString, loadEnv } from "./env.js";
import { getBinaryBookParamsHttp, getMarketOnchainHttp } from "./onchain.js";
import { shannonClient } from "./rpc.js";
import { canonicalOracleQuestionId } from "./marketIdentity.js";
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
  book: HumanBinaryBook | null;
  openPrice: number | null;
  closePrice: number | null;
  livePrice: number | null;
  priceHistory: { t: number; p: number }[];
  oracleQuestionId: string | null;
};

type Exchange = ReturnType<typeof createExchange>;
type Rpc = ReturnType<typeof shannonClient>;

async function probeMarket(opts: {
  exchange: Exchange;
  sh: Rpc;
  marketId: string;
  poolAddress?: string;
  asset?: string | null;
  intervalSec?: string | number | null;
  expiry?: string | number | null;
  status?: string;
  venueId?: string | null;
  oracleQuestionId?: string | null;
  opening: Record<string, string | null>;
  resolution: Record<string, string | null>;
  feedPrice: { BTC: number | null; ETH: number | null };
  feedHistory: { BTC: { t: number; p: number }[]; ETH: { t: number; p: number }[] };
}): Promise<HarnessRow | null> {
  const { exchange, sh, marketId } = opts;
  try {
    const onchain = await getMarketOnchainHttp(
      sh,
      SHANNON_ADDRESSES.binaryModule as Address,
      marketId as Hex,
    );
    const pool = (opts.poolAddress || onchain.pool) as Address;
    if (!pool || pool === "0x0000000000000000000000000000000000000000") return null;
    const params = await getBinaryBookParamsHttp(sh, onchain.pool);
    let fees: unknown = null;
    try {
      fees = await exchange.client.getMarketFees(marketId);
    } catch {
      fees = { error: "getMarketFees failed" };
    }
    let bookLevels: { bids: number; asks: number } | null = null;
    let book: HumanBinaryBook | null = null;
    try {
      const ob = await exchange.client.getBinaryOrderBook(pool, {
        depth: 5,
        decimals: onchain.decimals,
      });
      bookLevels = {
        bids: ob.yesBids?.length ?? 0,
        asks: ob.yesAsks?.length ?? 0,
      };
      book = humanBinaryBook(ob, onchain.decimals, 5);
    } catch {
      bookLevels = null;
      book = null;
    }
    const id = marketId.toLowerCase();
    const asset = (opts.asset ?? "").toUpperCase() === "ETH" ? "ETH" : "BTC";
    const indexedQ =
      opts.oracleQuestionId != null &&
      String(opts.oracleQuestionId) !== "" &&
      String(opts.oracleQuestionId) !== "0"
        ? String(opts.oracleQuestionId)
        : null;
    const onchainQ =
      onchain.oracleQuestionId && onchain.oracleQuestionId !== 0n
        ? onchain.oracleQuestionId.toString()
        : null;
    return {
      marketId,
      indexerStatus: opts.status,
      venueId: opts.venueId ?? undefined,
      asset: opts.asset ?? undefined,
      intervalSec: opts.intervalSec != null ? String(opts.intervalSec) : undefined,
      expiry: String(opts.expiry ?? onchain.expiry),
      onchainStatus: onchain.statusLabel,
      pool: onchain.pool,
      nonce: onchain.nonce.toString(),
      decimals: onchain.decimals,
      voidPolicy: onchain.voidPolicy,
      tickSize: params.tickSize.toString(),
      lotSize: params.lotSize.toString(),
      minQuantity: params.minQuantity.toString(),
      fees,
      bookLevels,
      book,
      openPrice: scaleOracleNumeric(opts.opening[id] ?? opts.opening[marketId]),
      closePrice: scaleOracleNumeric(opts.resolution[id] ?? opts.resolution[marketId]),
      livePrice: opts.feedPrice[asset],
      priceHistory: opts.feedHistory[asset],
      oracleQuestionId: canonicalOracleQuestionId(onchainQ, indexedQ),
    };
  } catch {
    return null;
  }
}

async function feedBundle(exchange: Exchange) {
  const [btcFeed, ethFeed, btcCandles, ethCandles] = await Promise.all([
    exchange.client.fetchPriceFeedInfo("BTC").catch(() => null),
    exchange.client.fetchPriceFeedInfo("ETH").catch(() => null),
    exchange.client.fetchPriceCandles("BTC", "M1", { limit: 60 }).catch(() => []),
    exchange.client.fetchPriceCandles("ETH", "M1", { limit: 60 }).catch(() => []),
  ]);
  return {
    feedPrice: {
      BTC: humanFeedPrice(btcFeed?.latest?.price),
      ETH: humanFeedPrice(ethFeed?.latest?.price),
    },
    feedHistory: {
      BTC: btcCandles.map((c) => ({ t: c.bucketStart * 1000, p: c.close })),
      ETH: ethCandles.map((c) => ({ t: c.bucketStart * 1000, p: c.close })),
    },
  };
}

/** One market (live or holding) with on-chain 5-level book. */
export async function readShannonMarket(marketId: string): Promise<HarnessRow | null> {
  loadEnv();
  const exchange = createExchange("shannon");
  const rpc = envString("SOMNIA_SHANNON_RPC_URL", DEFAULT_SHANNON_RPC)!;
  const sh = shannonClient(rpc);
  const [indexed, opening, resolution, feeds] = await Promise.all([
    exchange.client.getBinaryMarket(marketId).catch(() => null),
    exchange.client.getOpeningPrices([marketId]).catch(() => ({}) as Record<string, string | null>),
    exchange.client.getResolutionPrices([marketId]).catch(() => ({}) as Record<string, string | null>),
    feedBundle(exchange),
  ]);
  return probeMarket({
    exchange,
    sh,
    marketId,
    poolAddress: indexed?.poolAddress,
    asset: indexed?.asset,
    intervalSec: indexed?.intervalSec,
    expiry: indexed?.expiry,
    status: indexed?.status,
    venueId: indexed?.venueId,
    oracleQuestionId: indexed?.oracleQuestionId,
    opening,
    resolution,
    feedPrice: feeds.feedPrice,
    feedHistory: feeds.feedHistory,
  });
}

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
  const [opening, resolution, feeds] = await Promise.all([
    ids.length
      ? exchange.client.getOpeningPrices(ids).catch(() => ({}) as Record<string, string | null>)
      : ({} as Record<string, string | null>),
    ids.length
      ? exchange.client.getResolutionPrices(ids).catch(() => ({}) as Record<string, string | null>)
      : ({} as Record<string, string | null>),
    feedBundle(exchange),
  ]);
  const built = await Promise.all(
    slice.map((m) => {
      if (!m.marketId) return Promise.resolve(null);
      return probeMarket({
        exchange,
        sh,
        marketId: m.marketId,
        poolAddress: m.poolAddress,
        asset: m.asset,
        intervalSec: m.intervalSec,
        expiry: m.expiry,
        status: m.status,
        venueId: m.venueId,
        oracleQuestionId: m.oracleQuestionId,
        opening,
        resolution,
        feedPrice: feeds.feedPrice,
        feedHistory: feeds.feedHistory,
      });
    }),
  );
  const rows = built.filter((r): r is HarnessRow => r != null);

  const out = { generatedAt: new Date().toISOString(), count: rows.length, rows };
  mkdirSync(resolve(process.cwd(), "docs/evidence"), { recursive: true });
  writeFileSync(
    resolve(process.cwd(), "docs/evidence/harness-shannon.json"),
    JSON.stringify(out, null, 2),
  );
  return out;
}
