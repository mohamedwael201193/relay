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

export type FillClass = "NO_FILL" | "PARTIAL_FILL" | "FILL" | "UNKNOWN";

export function classifyFill(quantity: bigint, filled: bigint, placed: boolean): FillClass {
  if (!placed && filled === 0n) return "UNKNOWN";
  if (filled === 0n) return "NO_FILL";
  if (filled >= quantity) return "FILL";
  return "PARTIAL_FILL";
}
