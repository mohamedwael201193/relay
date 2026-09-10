import {
  assertShannonExecution,
  loadShannonDeployment,
  readVaultSnapshot,
  runDoctor,
  runLiveOrder,
  settleFilledMarket,
  protocolChecksFailed,
} from "@relay/core";
import {
  claimRunner,
  ensureRunner,
  listProof,
  persistWorkerStep,
  releaseRunner,
  setRunnerState,
} from "@relay/db";
import type { LocalAccount } from "viem/accounts";
import type { Hex } from "viem";

function log(event: string, extra: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...extra }));
}

export async function reconcileOnce(account: LocalAccount): Promise<{ action: string; runnerId?: string }> {
  assertShannonExecution();
  const dep = loadShannonDeployment();
  const doctor = await runDoctor({ skipTooling: true });
  if (protocolChecksFailed(doctor.checks) || doctor.failClosed && doctor.checks.some((c) => c.id.startsWith("shannon.") && c.status === "FAIL")) {
    log("doctor_block", { failClosed: doctor.failClosed });
    return { action: "doctor_block" };
  }

  const snap = await readVaultSnapshot(dep.vault);
  await ensureRunner({
    vault: dep.vault,
    owner: snap.owner,
    operator: snap.operator,
  });
  const runner = await claimRunner(dep.vault);
  if (!runner) {
    log("no_lease", { vault: dep.vault });
    return { action: "no_lease" };
  }

  try {
    if (snap.killed) {
      await setRunnerState(runner.id, "KILLED", { lastError: "vault killed on-chain" });
      log("killed", { vault: dep.vault, runnerId: runner.id });
      return { action: "killed", runnerId: runner.id };
    }

    const proof = await listProof(runner.id);
    const lastOrder = proof.orders.at(-1) as
      | { market_id: string; fill_class: string; tx_hash: string; lap_index: number }
      | undefined;
    const lastSettle = proof.settlements.at(-1) as { market_id: string; redeem_tx: string | null } | undefined;

    const needsSettle =
      lastOrder &&
      (lastOrder.fill_class === "FILL" || lastOrder.fill_class === "PARTIAL_FILL") &&
      !(lastSettle && lastSettle.market_id === lastOrder.market_id);

    if (needsSettle && lastOrder) {
      await setRunnerState(runner.id, "WAITING_SETTLEMENT", { lastMarketId: lastOrder.market_id });
      const settlement = await settleFilledMarket(account, lastOrder.market_id as Hex);
      const nextState = settlement.voided
        ? "SETTLED_VOID"
        : settlement.outcome === "loss"
          ? "SETTLED_LOSS"
          : settlement.redeemed
            ? "REDEEMED"
            : settlement.settled
              ? "REDEEMED"
              : "WAITING_SETTLEMENT";
      await persistWorkerStep({
        runnerId: runner.id,
        vault: dep.vault,
        lapIndex: lastOrder.lap_index,
        marketId: lastOrder.market_id,
        correlationId: `settle:${lastOrder.tx_hash}`,
        state: nextState,
        settlement: {
          resolved: settlement.resolved,
          voided: settlement.voided,
          payoutNumerators: settlement.payoutNumerators,
          redeemTx: settlement.redeemTx,
        },
      });
      await setRunnerState(runner.id, nextState, {
        lastMarketId: lastOrder.market_id,
      });
      log("settled", {
        runnerId: runner.id,
        marketId: lastOrder.market_id,
        outcome: settlement.outcome,
        settled: settlement.settled,
        redeemed: settlement.redeemed,
        redeemTx: settlement.redeemTx,
      });
      return { action: settlement.settled ? "settled" : "settlement_pending", runnerId: runner.id };
    }

    await setRunnerState(runner.id, "DISCOVERING");
    const skip = lastOrder?.market_id ? [lastOrder.market_id] : [];
    const placed = await runLiveOrder(account, {
      intervalSec: "60",
      iocOnly: true,
      skipMarketIds: skip,
      waitMs: 90_000,
      evidenceName: "shannon-worker-order.json",
    });
    const attempt = placed.ioc ?? placed.postOnly;
    if (!attempt) {
      await setRunnerState(runner.id, "ERROR", { lastError: "no attempt" });
      return { action: "no_attempt", runnerId: runner.id };
    }
    const filled = attempt.fillClass === "FILL" || attempt.fillClass === "PARTIAL_FILL";
    const nextIndex = (lastOrder?.lap_index ?? 0) + 1;
    await persistWorkerStep({
      runnerId: runner.id,
      vault: dep.vault,
      lapIndex: nextIndex,
      marketId: attempt.marketId,
      pool: attempt.pool,
      correlationId: attempt.correlationId,
      state: filled ? "FILLED" : attempt.placedEvent ? "ORDER_SUBMITTED" : "DISCOVERING",
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
    });
    await setRunnerState(runner.id, filled ? "FILLED" : "ORDER_SUBMITTED", {
      lastMarketId: attempt.marketId,
      bumpLap: true,
    });
    log("placed", {
      runnerId: runner.id,
      marketId: attempt.marketId,
      fillClass: attempt.fillClass,
      placeTx: attempt.placeTx,
      filled: attempt.filled,
    });
    return { action: filled ? "filled" : "placed", runnerId: runner.id };
  } catch (e) {
    const msg = (e as Error).message;
    await setRunnerState(runner.id, "ERROR", { lastError: msg.slice(0, 500) });
    log("error", { runnerId: runner.id, error: msg });
    throw e;
  } finally {
    await releaseRunner(runner.id);
  }
}

export async function runWorkerLoop(account: LocalAccount, opts: { once?: boolean; intervalMs?: number } = {}) {
  const intervalMs = opts.intervalMs ?? 15_000;
  for (;;) {
    try {
      const out = await reconcileOnce(account);
      log("tick", out);
    } catch (e) {
      log("tick_error", { error: (e as Error).message });
    }
    if (opts.once) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
