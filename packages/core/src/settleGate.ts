/** Whether a filled order still needs poke/sync/redeem. */

export type SettleOrderRef = {
  fill_class?: string | null;
  market_id?: string | null;
};

export type SettleRowRef = {
  market_id?: string | null;
  resolved?: boolean | string | null;
  voided?: boolean | string | null;
};

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
  return !settlementIsFinal(lastSettle);
}

/** `BinaryMarket.voidExpired()` opens at expiry + settlementWindow (SDK + DreamDEX docs). */
export function voidExpiredIsCallable(
  expiry: bigint,
  settlementWindow: bigint,
  blockTimestamp: bigint,
): boolean {
  return blockTimestamp >= expiry + settlementWindow;
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
