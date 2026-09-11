import type { Address, Hex } from "viem";
import { SHANNON_ADDRESSES, requiredAddress } from "./addresses.js";
import { binaryPoolReadAbi } from "./abis.js";
import { createExchange } from "./exchange.js";
import { getBinaryBookParamsHttp, getMarketOnchainHttp } from "./onchain.js";
import { shannonHttpClient } from "./sendHttp.js";

const MODULE = requiredAddress(SHANNON_ADDRESSES.binaryModule, "binaryModule");
const COLLATERAL = requiredAddress(SHANNON_ADDRESSES.collateral, "collateral");

export type LivePick = {
  marketId: Hex;
  pool: Address;
  book: { tickSize: bigint; lotSize: bigint; minQuantity: bigint };
  bestBid: bigint | null;
  bestAsk: bigint | null;
  bestNoBid: bigint | null;
  bestNoAsk: bigint | null;
  expireNs: bigint;
  nonce: bigint;
  decimals: number;
  asset?: string;
  intervalSec?: string;
};

export function normalizeExpireNs(poolExpireNs: bigint, moduleExpiry: bigint): bigint {
  if (poolExpireNs > 0n) return poolExpireNs;
  if (moduleExpiry === 0n) return 0n;
  if (moduleExpiry < 10_000_000_000n) return moduleExpiry * 1_000_000_000n;
  return moduleExpiry;
}

export function nowNs(): bigint {
  return BigInt(Date.now()) * 1_000_000n;
}

export function intervalMatches(actual: unknown, wanted?: string): boolean {
  if (!wanted) return true;
  return String(actual ?? "") === wanted;
}

/** Skip when `wanted` is non-empty and `actual` is missing or not in the list. */
export function assetMatches(actual: unknown, wanted?: string[]): boolean {
  if (!wanted || wanted.length === 0) return true;
  const a = String(actual ?? "").trim().toUpperCase();
  if (!a) return false;
  return wanted.some((w) => w.trim().toUpperCase() === a);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function probeOne(
  exchange: ReturnType<typeof createExchange>,
  client: ReturnType<typeof shannonHttpClient>,
  m: { marketId?: string; poolAddress?: string; asset?: string | null; intervalSec?: string | number | null },
  opts: { requireAsks: boolean; requireNoAsks: boolean; skip: Set<string> },
): Promise<LivePick | null> {
  if (!m.marketId || !m.poolAddress) return null;
  if (opts.skip.has(m.marketId.toLowerCase())) return null;
  const onchain = await getMarketOnchainHttp(client, MODULE, m.marketId as Hex);
  if (onchain.statusLabel !== "Trading") return null;
  if (onchain.collateral.toLowerCase() !== COLLATERAL.toLowerCase()) return null;
  if (onchain.pool === "0x0000000000000000000000000000000000000000") return null;
  const book = await getBinaryBookParamsHttp(client, onchain.pool);
  let poolExpire = 0n;
  try {
    poolExpire = await client.readContract({
      address: onchain.pool,
      abi: binaryPoolReadAbi,
      functionName: "marketExpiryNs",
    });
  } catch {
    poolExpire = 0n;
  }
  const expireNs = normalizeExpireNs(poolExpire, onchain.expiry);
  if (expireNs === 0n) return null;
  if (expireNs <= nowNs() + 8_000_000_000n) return null;
  let bestBid: bigint | null = null;
  let bestAsk: bigint | null = null;
  let bestNoBid: bigint | null = null;
  let bestNoAsk: bigint | null = null;
  try {
    const ob = await exchange.client.getBinaryOrderBook(m.poolAddress as Address);
    bestBid = ob.yesBids?.[0]?.price != null ? BigInt(ob.yesBids[0].price) : null;
    bestAsk = ob.yesAsks?.[0]?.price != null ? BigInt(ob.yesAsks[0].price) : null;
    bestNoBid = ob.noBids?.[0]?.price != null ? BigInt(ob.noBids[0].price) : null;
    bestNoAsk = ob.noAsks?.[0]?.price != null ? BigInt(ob.noAsks[0].price) : null;
  } catch {
    return null;
  }
  if (bestBid == null && bestAsk == null && bestNoBid == null && bestNoAsk == null) return null;
  if (opts.requireAsks && bestAsk == null) return null;
  if (opts.requireNoAsks && bestNoAsk == null) return null;
  return {
    marketId: m.marketId as Hex,
    pool: onchain.pool,
    book,
    bestBid,
    bestAsk,
    bestNoBid,
    bestNoAsk,
    expireNs,
    nonce: onchain.nonce,
    decimals: onchain.decimals,
    asset: m.asset ?? undefined,
    intervalSec: m.intervalSec != null ? String(m.intervalSec) : undefined,
  };
}

/** Headroom: refuse entry after 60% of the window (need ≥40% remaining). */
export const HEADROOM_REMAINING_FRAC = 0.4;
/** Prefer a window that has not yet aged past ~15% elapsed (or has not opened). */
export const FRESH_WINDOW_FRAC = 0.85;

export function remainingSecFromExpire(expireNs: bigint, now: bigint): number {
  if (expireNs <= now) return 0;
  return Number((expireNs - now) / 1_000_000_000n);
}

export function isFreshWindow(
  remainingSec: number,
  intervalSec: number,
  frac = FRESH_WINDOW_FRAC,
): boolean {
  if (!(intervalSec > 0) || !(remainingSec > 0)) return false;
  return remainingSec >= intervalSec * frac;
}

/**
 * Fresh windows first (a 15m that just opened, not the one already 7m in).
 * Among fresh: soonest expiry. Among leftovers: most remaining — never the dying book.
 */
export function rankLivePicks(
  a: { expireNs: bigint; intervalSec?: string },
  b: { expireNs: bigint; intervalSec?: string },
  now: bigint,
): number {
  const ia = Number(a.intervalSec ?? 0);
  const ib = Number(b.intervalSec ?? 0);
  if (ia !== ib && ia > 0 && ib > 0) return ia - ib;
  const ra = remainingSecFromExpire(a.expireNs, now);
  const rb = remainingSecFromExpire(b.expireNs, now);
  const fa = isFreshWindow(ra, ia);
  const fb = isFreshWindow(rb, ib);
  if (fa !== fb) return fa ? -1 : 1;
  if (fa && fb) {
    if (a.expireNs < b.expireNs) return -1;
    if (a.expireNs > b.expireNs) return 1;
    return 0;
  }
  if (a.expireNs > b.expireNs) return -1;
  if (a.expireNs < b.expireNs) return 1;
  return 0;
}

export async function discoverLiveMarket(opts: {
  intervalSec?: string;
  requireAsks?: boolean;
  requireNoAsks?: boolean;
  skipMarketIds?: string[];
  waitMs?: number;
  pollMs?: number;
  maxExpiryHorizonSec?: number;
  /** Skip windows with less than this fraction of interval remaining (concept headroom). */
  minRemainingFrac?: number;
  /** When set, skip in-progress windows below this remaining fraction (wait for the next open). */
  preferFreshFrac?: number;
  /** When non-empty, skip markets whose asset is not in the list. */
  assets?: string[];
} = {}): Promise<LivePick | null> {
  const waitMs = opts.waitMs ?? 90_000;
  const pollMs = opts.pollMs ?? 4_000;
  const requireAsks = opts.requireAsks ?? false;
  const requireNoAsks = opts.requireNoAsks ?? false;
  const skip = new Set((opts.skipMarketIds ?? []).map((id) => id.toLowerCase()));
  const deadline = Date.now() + waitMs;
  const client = shannonHttpClient();
  const exchange = createExchange("shannon");
  let lastCount = 0;

  while (Date.now() <= deadline) {
    const live = await exchange.client.listLiveBinaryMarkets({ limit: 40 });
    lastCount = live.length;
    const filtered = live.filter(
      (m) => intervalMatches(m.intervalSec, opts.intervalSec) && assetMatches(m.asset, opts.assets),
    );
    const pool =
      filtered.length > 0 ? filtered : opts.intervalSec ? [] : live.filter((m) => assetMatches(m.asset, opts.assets));
    const found: LivePick[] = [];
    for (const m of pool) {
      try {
        const pick = await probeOne(exchange, client, m, { requireAsks, requireNoAsks, skip });
        if (!pick) continue;
        const remainingSec = remainingSecFromExpire(pick.expireNs, nowNs());
        if (opts.maxExpiryHorizonSec != null && remainingSec > opts.maxExpiryHorizonSec) continue;
        const interval = Number(pick.intervalSec ?? 0);
        if (opts.minRemainingFrac != null && interval > 0) {
          if (remainingSec < interval * opts.minRemainingFrac) continue;
        }
        if (opts.preferFreshFrac != null && interval > 0) {
          if (!isFreshWindow(remainingSec, interval, opts.preferFreshFrac)) continue;
        }
        found.push(pick);
      } catch {
        /* skip broken row */
      }
    }
    found.sort((a, b) => rankLivePicks(a, b, nowNs()));
    if (found[0]) return found[0];
    if (Date.now() + pollMs > deadline) break;
    await sleep(pollMs);
  }
  if (lastCount === 0) return null;
  return null;
}
