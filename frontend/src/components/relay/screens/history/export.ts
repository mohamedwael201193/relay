"use client";

/**
 * RELAY — tape export.
 * Real CSV/JSON downloads of the settled-lap ledger, built from the
 * store's laps (the whole tape, in lap order). Blob + object URL +
 * programmatic click — no dependencies.
 */

import type { Lap } from "@/lib/relay/types";

const iso = (t: number) => new Date(t).toISOString();

interface Col {
  key: string;
  get: (l: Lap) => string | number | boolean;
}

const COLUMNS: Col[] = [
  { key: "lap", get: (l) => l.number },
  { key: "asset", get: (l) => l.market.asset },
  { key: "market_id", get: (l) => l.market.marketId },
  { key: "cadence", get: (l) => l.market.cadence },
  { key: "window_start", get: (l) => iso(l.market.windowStart) },
  { key: "window_end", get: (l) => iso(l.market.windowEnd) },
  { key: "open_price", get: (l) => l.market.openPrice },
  { key: "close_price", get: (l) => l.market.closePrice },
  { key: "side", get: (l) => l.side },
  { key: "entry_price", get: (l) => l.entryPrice },
  { key: "quantity_contracts", get: (l) => l.fill.quantity },
  { key: "stake_usdc", get: (l) => l.stake },
  { key: "order_kind", get: (l) => l.order.kind },
  { key: "order_latency_ms", get: (l) => l.order.latencyMs },
  { key: "order_block", get: (l) => l.order.tx.block },
  { key: "outcome", get: (l) => l.outcome },
  { key: "market_outcome", get: (l) => l.marketOutcome },
  { key: "pnl_usdc", get: (l) => l.pnl },
  { key: "streak_after", get: (l) => l.streakAfter },
  { key: "shielded", get: (l) => l.shielded },
  { key: "settled_at", get: (l) => iso(l.settledAt) },
  { key: "fill_tx", get: (l) => l.fill.tx.hash },
  { key: "order_tx", get: (l) => l.order.tx.hash },
  { key: "settlement_tx", get: (l) => l.proof.settlementTx },
  { key: "claim_tx", get: (l) => l.proof.claimTx },
  { key: "oracle_question_id", get: (l) => l.proof.oracleQuestionId },
  { key: "proof_status", get: (l) => l.proof.status },
  { key: "sealed_at", get: (l) => iso(l.proof.sealedAt) },
];

function csvCell(v: string | number | boolean): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function ordered(laps: Lap[]): Lap[] {
  return [...laps].sort((a, b) => a.number - b.number);
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export function downloadTapeCsv(laps: Lap[]): string {
  const rows = ordered(laps);
  const name = `relay-tape-${rows.length}laps-${stamp()}.csv`;
  const lines = [
    COLUMNS.map((c) => c.key).join(","),
    ...rows.map((l) => COLUMNS.map((c) => csvCell(c.get(l))).join(",")),
  ];
  save(new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" }), name);
  return name;
}

export function downloadTapeJson(laps: Lap[]): string {
  const rows = ordered(laps);
  const name = `relay-tape-${rows.length}laps-${stamp()}.json`;
  const payload = {
    format: "relay-tape/v1",
    exportedAt: new Date().toISOString(),
    laps: rows.length,
    lapsData: rows,
  };
  save(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), name);
  return name;
}
