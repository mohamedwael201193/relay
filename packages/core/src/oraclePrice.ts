/**
 * DreamDEX opening/resolution answers are indexer `numericValue` strings
 * without a decimals column. Explorer uses 2 d.p.; the on-chain price-feed
 * adapter uses 1e18 (SDK PRICE_FEED_DECIMALS). Live feed `latest.price` is
 * already human units.
 */
export function scaleOracleNumeric(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e14) return n / 1e18;
  if (Number.isInteger(n) && n >= 10_000) return n / 100;
  return n;
}

export function humanFeedPrice(price: number | null | undefined): number | null {
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  return price;
}

export async function marketBoundaryPrices(
  marketId: string,
): Promise<{ open: number | null; close: number | null }> {
  const { createExchange } = await import("./exchange.js");
  const ex = createExchange("shannon");
  const id = marketId.toLowerCase();
  const [opening, resolution] = await Promise.all([
    ex.client.getOpeningPrices([marketId]).catch(() => ({}) as Record<string, string | null>),
    ex.client.getResolutionPrices([marketId]).catch(() => ({}) as Record<string, string | null>),
  ]);
  return {
    open: scaleOracleNumeric(opening[id] ?? opening[marketId]),
    close: scaleOracleNumeric(resolution[id] ?? resolution[marketId]),
  };
}

/** Opening/close USD plus the on-chain OracleHub question id (Shannon → dev.oracle.somnia.host). */
export async function marketOracleMeta(marketId: string): Promise<{
  open: number | null;
  close: number | null;
  oracleQuestionId: string | null;
}> {
  const bounds = await marketBoundaryPrices(marketId);
  let oracleQuestionId: string | null = null;
  try {
    const { getMarketOnchainHttp } = await import("./onchain.js");
    const { shannonHttpClient } = await import("./sendHttp.js");
    const { SHANNON_ADDRESSES, requiredAddress } = await import("./addresses.js");
    const module = requiredAddress(SHANNON_ADDRESSES.binaryModule, "binaryModule");
    const onchain = await getMarketOnchainHttp(
      shannonHttpClient(),
      module,
      marketId as `0x${string}`,
    );
    if (onchain.oracleQuestionId && onchain.oracleQuestionId !== 0n) {
      oracleQuestionId = onchain.oracleQuestionId.toString();
    }
  } catch {
    /* question id is optional until the market is bound */
  }
  return { ...bounds, oracleQuestionId };
}
