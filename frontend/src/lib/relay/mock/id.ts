/**
 * RELAY — deterministic id/hash factory.
 * Mock layer only: stands in for real chain identifiers until the
 * DreamDEX SDK / Somnia indexer is wired. Deterministic per input so
 * demo recordings replay identically.
 */

const HEX = "0123456789abcdef";

function digest(input: string | number, len: number, salt: string) {
  // xfnv1a — small, stable, plenty for mock identifiers
  let h = 2166136261;
  const str = `${salt}:${input}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  let n = Math.abs(h);
  for (let i = 0; i < len; i++) {
    out += HEX[(n >>> (i % 4 === 0 ? 0 : i % 28)) % 16];
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    if (n < 0) n = Math.abs(n);
  }
  return out;
}

export function txHash(input: string | number) {
  return `0x${digest(input, 64, "tx")}`;
}

export function marketId(input: string | number) {
  return `0x${digest(input, 40, "mkt")}`;
}

export function questionId(input: string | number) {
  return `0x${digest(input, 40, "oracle")}`;
}

export function shortId(input: string | number) {
  return digest(input, 10, "id");
}

/** Deterministic block number: 12k+ so it reads like a live L1. */
export function blockFor(input: string | number) {
  return 4_210_000 + (Math.abs(digestNum(input, "blk")) % 90_000);
}

export function accountFor(input: string) {
  return `0x${digest(input, 40, "acct")}`;
}

function digestNum(input: string | number, salt: string) {
  let h = 2166136261;
  const str = `${salt}:${input}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h ^ (h >>> 15));
}

/** Seeded RNG (mulberry32) — deterministic per seed. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(next: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = next();
  while (v === 0) v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
