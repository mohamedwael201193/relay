/** Human 5-level binary book for the Live Lap ladder. Prices are YES/NO probability in [0,1]. */

export type HumanBookLevel = { price: number; size: number };

export type HumanBinaryBook = {
  bidUp: HumanBookLevel[];
  askUp: HumanBookLevel[];
  bidDown: HumanBookLevel[];
  askDown: HumanBookLevel[];
  spread: number | null;
};

type RawLevel = { price: bigint | string | number; quantity: bigint | string | number };

function scaleLevel(level: RawLevel, decimals: number): HumanBookLevel | null {
  const d = 10 ** decimals;
  const p = Number(level.price) / d;
  const s = Number(level.quantity) / d;
  if (!Number.isFinite(p) || !Number.isFinite(s) || p <= 0 || s <= 0) return null;
  return { price: p, size: s };
}

function take(levels: RawLevel[] | undefined, decimals: number, depth: number): HumanBookLevel[] {
  const out: HumanBookLevel[] = [];
  for (const level of levels ?? []) {
    const row = scaleLevel(level, decimals);
    if (row) out.push(row);
    if (out.length >= depth) break;
  }
  return out;
}

export function humanBinaryBook(
  ob: {
    yesBids?: RawLevel[];
    yesAsks?: RawLevel[];
    noBids?: RawLevel[];
    noAsks?: RawLevel[];
  },
  decimals: number,
  depth = 5,
): HumanBinaryBook {
  const bidUp = take(ob.yesBids, decimals, depth);
  const askUp = take(ob.yesAsks, decimals, depth);
  const bidDown = take(ob.noBids, decimals, depth);
  const askDown = take(ob.noAsks, decimals, depth);
  const spread =
    bidUp[0] && askUp[0] && askUp[0].price >= bidUp[0].price
      ? askUp[0].price - bidUp[0].price
      : null;
  return { bidUp, askUp, bidDown, askDown, spread };
}
