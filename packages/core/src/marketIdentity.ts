/**
 * Market/oracle identity. Pools are recycled; never key a question by pool.
 * Indexer is cache. On-chain `markets(marketId).oracleQuestionId` wins.
 * Shannon (50312) and Somnia mainnet (5031) reuse numeric question ids —
 * the explorer host is part of the identity, not a UI decoration.
 */

function normalizeQuestionId(raw: string | number | bigint | null | undefined): string | null {
  if (raw == null) return null;
  const s = typeof raw === "bigint" ? raw.toString() : String(raw).trim();
  if (!s || s === "0") return null;
  return s;
}

/** Chain-bound Prophecy explorer. Shannon ids are meaningless on prd.oracle (5031). */
export function oracleExplorerHost(chainId: number): string {
  if (chainId === 50312) return "dev.oracle.somnia.host";
  return "prd.oracle.somnia.host";
}

export function oracleQuestionUrl(
  id: string | number | bigint | null | undefined,
  chainId: number,
): string | null {
  const q = normalizeQuestionId(id);
  if (!q) return null;
  return `https://${oracleExplorerHost(chainId)}/questions/${q}?view=graph`;
}

/**
 * Authoritative question for a market. Indexer may still hold a previous
 * window's id after a pool recycle; that must not win.
 */
export function canonicalOracleQuestionId(
  onchain: string | number | bigint | null | undefined,
  indexed?: string | number | bigint | null,
): string | null {
  return normalizeQuestionId(onchain) ?? normalizeQuestionId(indexed);
}

export function settlementOracleQuestionId(opts: {
  marketId: string;
  onchainQuestionId: string | number | bigint | null | undefined;
  claimedQuestionId?: string | number | bigint | null;
}): { questionId: string | null; rejected: "missing" | "mismatch" | null } {
  const marketId = (opts.marketId ?? "").toLowerCase();
  if (!marketId || !/^0x[0-9a-f]{64}$/.test(marketId)) {
    return { questionId: null, rejected: "missing" };
  }
  const onchain = normalizeQuestionId(opts.onchainQuestionId);
  if (!onchain) return { questionId: null, rejected: "missing" };
  const claimed = normalizeQuestionId(opts.claimedQuestionId);
  if (claimed && claimed !== onchain) return { questionId: onchain, rejected: "mismatch" };
  return { questionId: onchain, rejected: null };
}
