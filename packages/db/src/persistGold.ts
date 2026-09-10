import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { withPool } from "./index.js";

type OrderEvidence = {
  vault: string;
  postOnly: { correlationId: string; marketId: string; placeTx: string; fillClass: string; filled: string; orderType: number; price: string; quantity: string; placeStatus: string; orderId: string | null };
  ioc: { correlationId: string; placeTx: string; fillClass: string; filled: string; orderType: number; price: string; quantity: string; placeStatus: string; orderId: string | null; marketId: string } | null;
};

type SettleEvidence = {
  marketId: string;
  vault: string;
  resolved: boolean;
  voided: boolean;
  payoutNumerators: string[];
  redeemTx: string | null;
};

export async function persistShannonGold(): Promise<{ runnerId: string }> {
  const order = JSON.parse(
    readFileSync(resolve(process.cwd(), "docs/evidence/shannon-order.json"), "utf8"),
  ) as OrderEvidence;
  const settle = JSON.parse(
    readFileSync(resolve(process.cwd(), "docs/evidence/shannon-settlement.json"), "utf8"),
  ) as SettleEvidence;

  return withPool(async (c) => {
    const runner = await c.query<{ id: string }>(
      `INSERT INTO runners (vault, owner, operator, state, chain_id)
       VALUES ($1, $2, $2, 'REDEEMED', 50312)
       ON CONFLICT (chain_id, vault)
       DO UPDATE SET state = 'REDEEMED', updated_at = now()
       RETURNING id`,
      [order.vault, "0xBDfCeE82Bd42FEfA58ee850B3709636a8B6b0034"],
    );
    const runnerId = runner.rows[0].id;
    const lap = await c.query<{ id: string }>(
      `INSERT INTO laps (runner_id, lap_index, market_id, pool, state, correlation_id)
       VALUES ($1, 1, $2, $3, 'REDEEMED', $4)
       ON CONFLICT (runner_id, lap_index)
       DO UPDATE SET state = 'REDEEMED', market_id = EXCLUDED.market_id
       RETURNING id`,
      [runnerId, order.ioc?.marketId ?? order.postOnly.marketId, null, order.postOnly.correlationId],
    );
    const lapId = lap.rows[0].id;
    for (const o of [order.postOnly, order.ioc]) {
      if (!o) continue;
      await c.query(
        `INSERT INTO orders (lap_id, attempt_id, tx_hash, order_id, order_type, price, quantity, filled, fill_class, receipt_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (attempt_id) DO UPDATE SET fill_class = EXCLUDED.fill_class, filled = EXCLUDED.filled`,
        [lapId, o.correlationId, o.placeTx, o.orderId, o.orderType, o.price, o.quantity, o.filled, o.fillClass, o.placeStatus],
      );
    }
    await c.query(
      `INSERT INTO settlements (lap_id, market_id, resolved, voided, payout_numerators, redeem_tx)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [lapId, settle.marketId, settle.resolved, settle.voided, settle.payoutNumerators, settle.redeemTx],
    );
    return { runnerId };
  });
}
