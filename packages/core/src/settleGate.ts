/** Whether a filled order still needs poke/sync/redeem. */

export type SettleOrderRef = {
  fill_class?: string | null;
  market_id?: string | null;
};

export type SettleRowRef = {
  market_id?: string | null;
  resolved?: boolean | string | null;
  voided?: boolean | string | null;
  redeem_tx?: string | null;
};

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

export function settlementHasProofTx(row: SettleRowRef | null | undefined): boolean {
  const tx = row?.redeem_tx ?? "";
  return TX_HASH.test(tx);
}

function isFilled(fillClass: string | null | undefined): boolean {
  return fillClass === "FILL" || fillClass === "PARTIAL_FILL";
}

function truthyFlag(v: boolean | string | null | undefined): boolean {
  return v === true || v === "t" || v === "true";
}

export function settlementIsFinal(row: SettleRowRef | null | undefined): boolean {
  if (!row) return false;
  return truthyFlag(row.resolved) || truthyFlag(row.voided);
}

/** Final settlement rows that never stored a chain hash (typical 0-payout loss). */
export function settlementsMissingProofTx<T extends SettleRowRef>(
  rows: T[] | null | undefined,
  limit = 8,
): T[] {
  if (!rows?.length) return [];
  return rows
    .filter((s) => Boolean(s.market_id) && settlementIsFinal(s) && !settlementHasProofTx(s))
    .slice(-limit);
}

/**
 * True when the latest order filled and there is no final settlement for that market.
 * An unresolved settlement row must not skip redeem — that was dropping PnL and
 * stacking the next lap on an open position.
 */
export function filledOrderNeedsSettle(
  lastOrder: SettleOrderRef | null | undefined,
  lastSettle: SettleRowRef | null | undefined,
): boolean {
  if (!lastOrder || !isFilled(lastOrder.fill_class)) return false;
  const market = (lastOrder.market_id ?? "").toLowerCase();
  if (!market) return false;
  if (!lastSettle || (lastSettle.market_id ?? "").toLowerCase() !== market) return true;
  if (!settlementIsFinal(lastSettle)) return true;
  return !settlementHasProofTx(lastSettle);
}

/** `BinaryMarket.voidExpired()` opens at expiry + settlementWindow (SDK + DreamDEX docs). */
export function voidExpiredIsCallable(
  expiry: bigint,
  settlementWindow: bigint,
  blockTimestamp: bigint,
): boolean {
  return blockTimestamp >= expiry + settlementWindow;
}

/**
 * Sequence pattern: Reactivity `_onEvent` is the primary vault settle.
 * `syncResolution` is recovery when there is no subscription or the
 * callback did not consume the arm after one wait.
 */
export function shouldWaitForReactivity(opts: {
  marketTerminal: boolean;
  subscribed: boolean;
  armedActive: boolean;
  armedMarketId: string;
  marketId: string;
  alreadyWaited: boolean;
}): boolean {
  if (!opts.marketTerminal) return false;
  if (!opts.subscribed) return false;
  if (opts.alreadyWaited) return false;
  if (!opts.armedActive) return false;
  return opts.armedMarketId.toLowerCase() === opts.marketId.toLowerCase();
}

/** Reconstruct pnl from escrow + redeem when the worker did not persist it. Never invents. */
export function derivedPnlRaw(
  pnl: string | null | undefined,
  entryCost: string | null | undefined,
  redeemValue: string | null | undefined,
): string | null {
  if (pnl != null && pnl !== "") return pnl;
  if (entryCost == null || entryCost === "" || redeemValue == null || redeemValue === "") {
    return pnl ?? null;
  }
  try {
    return (BigInt(redeemValue) - BigInt(entryCost)).toString();
  } catch {
    return pnl ?? null;
  }
}
