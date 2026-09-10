/** Raw-unit grid snap used for DreamDEX tick/lot. Never uses Sequence PRICE_SCALE. */

export function snapDown(raw: bigint, step: bigint): bigint {
  if (step <= 0n) throw new Error("step must be > 0");
  return (raw / step) * step;
}

export function snapUp(raw: bigint, step: bigint): bigint {
  if (step <= 0n) throw new Error("step must be > 0");
  const down = snapDown(raw, step);
  return down === raw ? raw : down + step;
}

export function snapQuantity(raw: bigint, lotSize: bigint, minQuantity: bigint): bigint {
  let q = snapDown(raw, lotSize);
  if (q < minQuantity) q = snapUp(minQuantity, lotSize);
  if (q < minQuantity) throw new Error("quantity below minimum after lot snap");
  return q;
}

/**
 * BUY_YES escrow: ceil(price * qty / unit). Matches SDK writer.ts and RunnerVault.collateralCost.
 * `price` is YES-terms. Prefer {@link collateralCostForKind} when kind is not BUY_YES.
 */
export function collateralCost(price: bigint, quantity: bigint, unit: bigint): bigint {
  return collateralCostForKind(0, price, quantity, unit);
}

/**
 * Vault/SDK escrow. `priceYes` is always YES-terms (writer.ts BUY_NO uses
 * ceil(qty * (unit - price) / unit); kind 0 = BUY_YES, kind 2 = BUY_NO).
 */
export function collateralCostForKind(kind: number, priceYes: bigint, qty: bigint, unit: bigint): bigint {
  if (unit <= 0n) throw new Error("unit must be > 0");
  if (kind === 0) {
    return (priceYes * qty + unit - 1n) / unit;
  }
  if (kind === 2) {
    if (priceYes >= unit) throw new Error("BUY_NO yes price must be < unit");
    return (qty * (unit - priceYes) + unit - 1n) / unit;
  }
  throw new Error(`unsupported kind ${kind}`);
}

/**
 * Largest lot-snapped quantity whose escrow is ≤ stake and ≤ cap.
 * Invert of collateralCostForKind — never inflate qty past what the vault can pay.
 * `price` is YES-terms. `kind` 0 = BUY_YES (default), 2 = BUY_NO.
 */
export function quantityForStake(opts: {
  stake: bigint;
  price: bigint;
  unit: bigint;
  lotSize: bigint;
  minQuantity: bigint;
  cap: bigint;
  kind?: number;
}): bigint {
  const { price, unit, lotSize, minQuantity } = opts;
  const kind = opts.kind ?? 0;
  if (price < 0n) throw new Error("price must be >= 0");
  if (kind === 2) {
    if (price >= unit) throw new Error("BUY_NO yes price must be < unit");
  } else if (price <= 0n) {
    throw new Error("price must be > 0");
  }
  const budget = opts.stake < opts.cap ? opts.stake : opts.cap;
  if (budget <= 0n) throw new Error("stake must be > 0");
  const costOf = (q: bigint) => collateralCostForKind(kind, price, q, unit);
  const divisor = kind === 2 ? unit - price : price;
  if (divisor <= 0n) throw new Error("escrow divisor must be > 0");
  let qty = snapDown((budget * unit) / divisor, lotSize);
  while (qty >= minQuantity && costOf(qty) > budget) {
    qty -= lotSize;
  }
  if (qty < minQuantity) {
    const minQ = snapQuantity(minQuantity, lotSize, minQuantity);
    const minCost = costOf(minQ);
    if (minCost > budget) {
      throw new Error(`stake ${budget} below min-lot cost ${minCost}`);
    }
    return minQ;
  }
  return qty;
}

/** s_n = clamp(base × (1 + λ × n), perWindowCap, remaining). λ is a sizing policy, not an edge. */
export function policyStakeRaw(opts: {
  vaultBal: bigint;
  perWindowCap: bigint;
  streak: number;
  baseBps?: bigint;
  lambdaBps?: bigint;
  maxStakeBps?: bigint;
}): bigint {
  const baseBps = opts.baseBps ?? 600n;
  const lambdaBps = opts.lambdaBps ?? 900n;
  const maxStakeBps = opts.maxStakeBps ?? 1000n;
  if (opts.vaultBal <= 0n) throw new Error("vault empty");
  const base = (opts.vaultBal * baseBps) / 10_000n;
  const n = BigInt(Math.max(0, Math.floor(opts.streak)));
  let stake = (base * (10_000n + lambdaBps * n)) / 10_000n;
  const pctCap = (opts.vaultBal * maxStakeBps) / 10_000n;
  if (stake > pctCap) stake = pctCap;
  if (stake > opts.perWindowCap) stake = opts.perWindowCap;
  if (stake > opts.vaultBal) stake = opts.vaultBal;
  if (stake <= 0n) throw new Error("computed stake is 0");
  return stake;
}

export type FillClass = "NO_FILL" | "PARTIAL_FILL" | "FILL" | "UNKNOWN";

export function classifyFill(quantity: bigint, filled: bigint, placed: boolean): FillClass {
  if (!placed && filled === 0n) return "UNKNOWN";
  if (filled === 0n) return "NO_FILL";
  if (filled >= quantity) return "FILL";
  return "PARTIAL_FILL";
}
