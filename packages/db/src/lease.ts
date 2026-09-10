import { withPool } from "./pool.js";

export type RunnerRow = {
  id: string;
  vault: string;
  owner: string;
  operator: string;
  state: string;
  chain_id: number;
  last_error: string | null;
  last_market_id: string | null;
  lap_index: number;
  bias: string;
  interval_sec: string;
  assets: string[];
};

const RUNNER_COLS =
  "id, vault, owner, operator, state, chain_id, last_error, last_market_id, lap_index, bias, interval_sec, assets";

export async function ensureRunner(input: {
  vault: string;
  owner: string;
  operator: string;
  chainId?: number;
}): Promise<RunnerRow> {
  const chainId = input.chainId ?? 50312;
  return withPool(async (c) => {
    const row = await c.query<RunnerRow>(
      `INSERT INTO runners (vault, owner, operator, state, chain_id)
       VALUES ($1, $2, $3, 'FUNDED', $4)
       ON CONFLICT (chain_id, vault)
       DO UPDATE SET owner = EXCLUDED.owner, operator = EXCLUDED.operator, updated_at = now()
       RETURNING ${RUNNER_COLS}`,
      [input.vault, input.owner, input.operator, chainId],
    );
    return row.rows[0];
  });
}

export async function updateRunnerPolicy(
  id: string,
  policy: { bias?: string; intervalSec?: string; assets?: string[] },
): Promise<RunnerRow> {
  return withPool(async (c) => {
    const row = await c.query<RunnerRow>(
      `UPDATE runners
       SET bias = COALESCE($2, bias),
           interval_sec = COALESCE($3, interval_sec),
           assets = COALESCE($4, assets),
           updated_at = now()
       WHERE id = $1
       RETURNING ${RUNNER_COLS}`,
      [id, policy.bias ?? null, policy.intervalSec ?? null, policy.assets ?? null],
    );
    if (!row.rows[0]) throw new Error(`runner ${id} not found`);
    return row.rows[0];
  });
}

const CLAIMABLE_STATES = [
  "ACTIVE",
  "DISCOVERING",
  "PREPARING",
  "ORDER_SUBMITTED",
  "PARTIAL_FILL",
  "FILLED",
  "WAITING_SETTLEMENT",
  "SETTLED_WIN",
  "SETTLED_LOSS",
  "SETTLED_VOID",
  "REDEEMING",
  "REDEEMED",
  "REARMING",
  "ERROR",
] as const;

export async function claimRunner(vault?: string): Promise<RunnerRow | null> {
  return withPool(async (c) => {
    const row = await c.query<RunnerRow>(
      `UPDATE runners
       SET lease_until = now() + interval '120 seconds', updated_at = now()
       WHERE id = (
         SELECT id FROM runners
         WHERE state = ANY($2::text[])
           AND (lease_until IS NULL OR lease_until < now())
           AND ($1::text IS NULL OR lower(vault) = lower($1))
         ORDER BY updated_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       RETURNING ${RUNNER_COLS}`,
      [vault ?? null, [...CLAIMABLE_STATES]],
    );
    return row.rows[0] ?? null;
  });
}

export async function releaseRunner(id: string): Promise<void> {
  await withPool(async (c) => {
    await c.query(`UPDATE runners SET lease_until = NULL, updated_at = now() WHERE id = $1`, [id]);
  });
}

export async function setRunnerState(
  id: string,
  state: string,
  extra: { lastError?: string | null; lastMarketId?: string | null; bumpLap?: boolean } = {},
): Promise<void> {
  await withPool(async (c) => {
    await c.query(
      `UPDATE runners
       SET state = $2,
           last_error = $3,
           last_market_id = COALESCE($4, last_market_id),
           lap_index = CASE WHEN $5 THEN lap_index + 1 ELSE lap_index END,
           updated_at = now()
       WHERE id = $1`,
      [id, state, extra.lastError ?? null, extra.lastMarketId ?? null, Boolean(extra.bumpLap)],
    );
  });
}

export async function listRunnersByOwner(owner: string): Promise<RunnerRow[]> {
  return withPool(async (c) => {
    const r = await c.query<RunnerRow>(
      `SELECT ${RUNNER_COLS}
       FROM runners WHERE lower(owner) = lower($1)
       ORDER BY updated_at DESC`,
      [owner],
    );
    return r.rows;
  });
}

export async function getRunnerByVault(vault: string): Promise<RunnerRow | null> {
  return withPool(async (c) => {
    const r = await c.query<RunnerRow>(
      `SELECT ${RUNNER_COLS}
       FROM runners WHERE lower(vault) = lower($1)`,
      [vault],
    );
    return r.rows[0] ?? null;
  });
}

export async function listLaps(runnerId: string) {
  return withPool(async (c) => {
    const r = await c.query(
      `SELECT id, lap_index, market_id, pool, state, correlation_id, created_at, asset, interval_sec, entry_cost, redeem_value, pnl, shielded
       FROM laps WHERE runner_id = $1 ORDER BY lap_index ASC`,
      [runnerId],
    );
    return r.rows;
  });
}

export async function listProof(runnerId: string) {
  return withPool(async (c) => {
    const orders = await c.query(
      `SELECT o.attempt_id, o.tx_hash, o.fill_class, o.filled, o.receipt_status, o.price, o.quantity, o.order_type, o.kind, o.created_at, l.market_id, l.lap_index
       FROM orders o JOIN laps l ON l.id = o.lap_id
       WHERE l.runner_id = $1 ORDER BY o.created_at ASC`,
      [runnerId],
    );
    const settlements = await c.query(
      `SELECT s.market_id, s.resolved, s.voided, s.payout_numerators, s.redeem_tx, s.created_at, l.lap_index
       FROM settlements s JOIN laps l ON l.id = s.lap_id
       WHERE l.runner_id = $1 ORDER BY s.created_at ASC`,
      [runnerId],
    );
    const records = await c.query(
      `SELECT kind, tx_hash, fill_class, payload, created_at FROM verification_records
       WHERE runner_id = $1 ORDER BY created_at ASC`,
      [runnerId],
    );
    return { orders: orders.rows, settlements: settlements.rows, records: records.rows };
  });
}

export async function persistWorkerStep(input: {
  runnerId: string;
  vault: string;
  lapIndex: number;
  marketId: string;
  pool?: string | null;
  correlationId: string;
  state: string;
  asset?: string | null;
  intervalSec?: string | null;
  entryCost?: string | null;
  redeemValue?: string | null;
  pnl?: string | null;
  shielded?: boolean;
  order?: {
    attemptId: string;
    txHash: string;
    orderId: string | null;
    orderType: number;
    kind?: string;
    price: string;
    quantity: string;
    filled: string;
    fillClass: string;
    receiptStatus: string;
  };
  settlement?: {
    resolved: boolean;
    voided: boolean;
    payoutNumerators: string[];
    redeemTx: string | null;
  };
}): Promise<void> {
  await withPool(async (c) => {
    const lap = await c.query<{ id: string }>(
      `INSERT INTO laps (runner_id, lap_index, market_id, pool, state, correlation_id, asset, interval_sec, entry_cost, redeem_value, pnl, shielded)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (runner_id, lap_index)
       DO UPDATE SET
         market_id = EXCLUDED.market_id,
         state = EXCLUDED.state,
         correlation_id = EXCLUDED.correlation_id,
         asset = COALESCE(EXCLUDED.asset, laps.asset),
         interval_sec = COALESCE(EXCLUDED.interval_sec, laps.interval_sec),
         entry_cost = COALESCE(EXCLUDED.entry_cost, laps.entry_cost),
         redeem_value = COALESCE(EXCLUDED.redeem_value, laps.redeem_value),
         pnl = COALESCE(EXCLUDED.pnl, laps.pnl),
         shielded = laps.shielded OR EXCLUDED.shielded
       RETURNING id`,
      [
        input.runnerId,
        input.lapIndex,
        input.marketId,
        input.pool ?? null,
        input.state,
        input.correlationId,
        input.asset ?? null,
        input.intervalSec ?? null,
        input.entryCost ?? null,
        input.redeemValue ?? null,
        input.pnl ?? null,
        input.shielded ?? false,
      ],
    );
    const lapId = lap.rows[0].id;
    if (input.order) {
      await c.query(
        `INSERT INTO orders (lap_id, attempt_id, tx_hash, order_id, order_type, kind, price, quantity, filled, fill_class, receipt_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (attempt_id) DO UPDATE SET
           fill_class = EXCLUDED.fill_class,
           filled = EXCLUDED.filled,
           tx_hash = EXCLUDED.tx_hash,
           kind = COALESCE(EXCLUDED.kind, orders.kind)`,
        [
          lapId,
          input.order.attemptId,
          input.order.txHash,
          input.order.orderId,
          input.order.orderType,
          input.order.kind ?? null,
          input.order.price,
          input.order.quantity,
          input.order.filled,
          input.order.fillClass,
          input.order.receiptStatus,
        ],
      );
    }
    if (input.settlement) {
      await c.query(
        `INSERT INTO settlements (lap_id, market_id, resolved, voided, payout_numerators, redeem_tx)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (lap_id) DO UPDATE SET
           resolved = EXCLUDED.resolved,
           voided = EXCLUDED.voided,
           payout_numerators = EXCLUDED.payout_numerators,
           redeem_tx = COALESCE(EXCLUDED.redeem_tx, settlements.redeem_tx)`,
        [
          lapId,
          input.marketId,
          input.settlement.resolved,
          input.settlement.voided,
          input.settlement.payoutNumerators,
          input.settlement.redeemTx,
        ],
      );
    }
    await c.query(
      `INSERT INTO verification_records (runner_id, lap_id, kind, tx_hash, fill_class, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        input.runnerId,
        lapId,
        input.order ? "order" : input.settlement ? "settlement" : "state",
        input.order?.txHash ?? input.settlement?.redeemTx ?? null,
        input.order?.fillClass ?? null,
        JSON.stringify({
          state: input.state,
          marketId: input.marketId,
          asset: input.asset ?? null,
          intervalSec: input.intervalSec ?? null,
          kind: input.order?.kind ?? null,
        }),
      ],
    );
  });
}