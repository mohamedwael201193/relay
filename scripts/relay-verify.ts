/**
 * Replay a vault tape from the live API using the same formulas as Tape/Analytics.
 * Usage: pnpm verify [vault]
 */
import { loadEnv, verifyTape } from "@relay/core";

loadEnv();

const api = (process.env.RELAY_API_URL ?? "https://relay-api-71gi.onrender.com").replace(/\/$/, "");
const vault = String(process.argv[2] ?? process.env.VERIFY_VAULT ?? "").trim();
if (!/^0x[0-9a-fA-F]{40}$/.test(vault)) {
  console.error("usage: pnpm verify <vault>");
  process.exit(2);
}

const historyRes = await fetch(`${api}/v1/runners/${vault}/history`);
const proofRes = await fetch(`${api}/v1/runners/${vault}/proof`);
if (!historyRes.ok || !proofRes.ok) {
  console.error(JSON.stringify({ error: "fetch_failed", history: historyRes.status, proof: proofRes.status }));
  process.exit(1);
}
const history = (await historyRes.json()) as {
  laps: Array<{
    lap_index: number;
    state: string;
    entry_cost: string | null;
    redeem_value: string | null;
    pnl: string | null;
    shielded: boolean;
  }>;
};
const proof = (await proofRes.json()) as {
  proof: {
    orders: Array<{ lap_index: number; fill_class: string; tx_hash: string }>;
    settlements: Array<{ lap_index: number; redeem_tx: string | null }>;
  };
};

const rows = history.laps.map((lap) => {
  const order = proof.proof.orders.find((o) => o.lap_index === lap.lap_index);
  const settle = proof.proof.settlements.find((s) => s.lap_index === lap.lap_index);
  return {
    lap_index: lap.lap_index,
    state: lap.state,
    entry_cost: lap.entry_cost,
    redeem_value: lap.redeem_value,
    pnl: lap.pnl,
    shielded: lap.shielded,
    fill_class: order?.fill_class ?? null,
    fill_tx: order?.tx_hash ?? null,
    redeem_tx: settle?.redeem_tx ?? null,
  };
});

const report = verifyTape(rows);
const winPct =
  report.stats.winRate == null ? "—" : `${(report.stats.winRate * 100).toFixed(1)}% · n=${report.stats.sampleN}`;
console.log(
  JSON.stringify(
    {
      vault: vault.toLowerCase(),
      ok: report.ok,
      winRate: winPct,
      netPnl: report.stats.netPnl,
      streak: report.streak,
      flags: report.flags,
      laps: rows.length,
    },
    null,
    2,
  ),
);
process.exit(report.ok ? 0 : 1);
