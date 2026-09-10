import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { persistWorkerStep, ensureRunner } from "./lease.js";
import { withPool } from "./pool.js";

type OrderAttempt = {
  correlationId: string;
  marketId: string;
  placeTx: string;
  fillClass: string;
  filled: string;
  orderType: number;
  price: string;
  quantity: string;
  placeStatus: string;
  orderId: string | null;
  pool?: string;
};

type OrderEvidence = {
  vault: string;
  asset?: string;
  intervalSec?: string;
  postOnly: OrderAttempt | null;
  ioc: OrderAttempt | null;
};

type SettleEvidence = {
  marketId: string;
  vault: string;
  resolved: boolean;
  voided: boolean;
  payoutNumerators: string[];
  redeemTx: string | null;
};

const OWNER = "0xBDfCeE82Bd42FEfA58ee850B3709636a8B6b0034";

function readJson<T>(name: string): T | null {
  const p = resolve(process.cwd(), "docs/evidence", name);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as T;
}

export async function persistShannonGold(): Promise<{ runnerId: string }> {
  const order = readJson<OrderEvidence>("shannon-order.json");
  const settle = readJson<SettleEvidence>("shannon-settlement.json");
  if (!order || !settle) throw new Error("missing shannon-order.json or shannon-settlement.json");
  const attempt = order.ioc ?? order.postOnly;
  if (!attempt) throw new Error("order evidence has neither ioc nor postOnly");

  const runner = await ensureRunner({ vault: order.vault, owner: OWNER, operator: OWNER });
  await persistWorkerStep({
    runnerId: runner.id,
    vault: order.vault,
    lapIndex: 1,
    marketId: attempt.marketId,
    pool: attempt.pool ?? null,
    correlationId: attempt.correlationId,
    state: "REDEEMED",
    asset: order.asset ?? null,
    intervalSec: order.intervalSec ?? null,
    order: {
      attemptId: attempt.correlationId,
      txHash: attempt.placeTx,
      orderId: attempt.orderId,
      orderType: attempt.orderType,
      price: attempt.price,
      quantity: attempt.quantity,
      filled: attempt.filled,
      fillClass: attempt.fillClass,
      receiptStatus: attempt.placeStatus,
    },
    settlement: {
      resolved: settle.resolved,
      voided: settle.voided,
      payoutNumerators: settle.payoutNumerators,
      redeemTx: settle.redeemTx,
    },
  });
  await withPool(async (c) => {
    await c.query(`UPDATE runners SET state = 'REDEEMED', updated_at = now() WHERE id = $1`, [runner.id]);
  });
  return { runnerId: runner.id };
}

export type GoldE2eEvidence = {
  vault: string;
  lap1: { marketId: string; fillClass?: string | null; placeTx?: string | null; filled?: string | null };
  lap2: { marketId?: string | null; fillClass?: string | null; placeTx?: string | null; filled?: string | null };
  settlement: {
    redeemed: boolean;
    redeemTx: string | null;
    resolved?: boolean;
    voided?: boolean;
  };
};

export async function persistGoldE2e(evidence?: GoldE2eEvidence): Promise<{ runnerId: string }> {
  const ev = evidence ?? readJson<GoldE2eEvidence>("shannon-gold-e2e.json");
  if (!ev) throw new Error("missing shannon-gold-e2e.json");
  const lap1 = readJson<OrderEvidence>("shannon-gold-lap1.json");
  const lap2 = readJson<OrderEvidence>("shannon-gold-lap2.json");
  const runner = await ensureRunner({ vault: ev.vault, owner: OWNER, operator: OWNER });

  const a1 = lap1?.ioc ?? lap1?.postOnly;
  if (a1) {
    await persistWorkerStep({
      runnerId: runner.id,
      vault: ev.vault,
      lapIndex: Math.max(1, runner.lap_index || 1),
      marketId: a1.marketId,
      pool: a1.pool ?? null,
      correlationId: a1.correlationId,
      state: ev.settlement.redeemed ? "REDEEMED" : "WAITING_SETTLEMENT",
      asset: lap1?.asset ?? null,
      intervalSec: lap1?.intervalSec ?? null,
      order: {
        attemptId: a1.correlationId,
        txHash: a1.placeTx,
        orderId: a1.orderId,
        orderType: a1.orderType,
        price: a1.price,
        quantity: a1.quantity,
        filled: a1.filled,
        fillClass: a1.fillClass,
        receiptStatus: a1.placeStatus,
      },
      settlement: {
        resolved: Boolean(ev.settlement.resolved),
        voided: Boolean(ev.settlement.voided),
        payoutNumerators: [],
        redeemTx: ev.settlement.redeemTx,
      },
    });
  }
  const a2 = lap2?.ioc ?? lap2?.postOnly;
  if (a2) {
    await persistWorkerStep({
      runnerId: runner.id,
      vault: ev.vault,
      lapIndex: Math.max(2, (runner.lap_index || 1) + 1),
      marketId: a2.marketId,
      pool: a2.pool ?? null,
      correlationId: a2.correlationId,
      state: a2.fillClass === "FILL" || a2.fillClass === "PARTIAL_FILL" ? "FILLED" : "ORDER_SUBMITTED",
      asset: lap2?.asset ?? null,
      intervalSec: lap2?.intervalSec ?? null,
      order: {
        attemptId: a2.correlationId,
        txHash: a2.placeTx,
        orderId: a2.orderId,
        orderType: a2.orderType,
        price: a2.price,
        quantity: a2.quantity,
        filled: a2.filled,
        fillClass: a2.fillClass,
        receiptStatus: a2.placeStatus,
      },
    });
  }
  await withPool(async (c) => {
    await c.query(
      `UPDATE runners SET state = $2, last_market_id = $3, lap_index = GREATEST(lap_index, 2), updated_at = now() WHERE id = $1`,
      [runner.id, a2 ? "FILLED" : "REDEEMED", a2?.marketId ?? ev.lap1.marketId],
    );
  });
  return { runnerId: runner.id };
}
