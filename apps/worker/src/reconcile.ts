import {
  assertShannonExecution,
  collateralCostForKind,
  filledOrderNeedsSettle,
  marketOracleMeta,
  readLapSettledProofTx,
  settlementsMissingProofTx,
  policyStakeRaw,
  readVaultSnapshot,
  refillVaultShield,
  registerMarketSubscription,
  runDoctor,
  runLiveOrder,
  sendTelegram,
  telegramLapText,
  settleFilledMarket,
  protocolChecksFailed,
  shortestPath,
  streakFromLapStates,
  type RunnerState,
} from "@relay/core";
import {
  claimRunner,
  ensureRunner,
  listLaps,
  listProof,
  persistWorkerStep,
  patchSettlementProofTx,
  releaseRunner,
  setRunnerState,
} from "@relay/db";
import type { LocalAccount } from "viem/accounts";
import type { Address, Hex } from "viem";

function streakCurrent(laps: Array<{ state: string; shielded?: boolean | string | null }>): number {
  return streakFromLapStates(laps);
}

function log(event: string, extra: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...extra }));
}

function asBias(raw: unknown): "UP" | "DOWN" | "FOLLOW" {
  const s = String(raw ?? "FOLLOW").trim().toUpperCase();
  if (s === "UP" || s === "DOWN" || s === "FOLLOW") return s;
  return "FOLLOW";
}

function asIntervalSec(raw: unknown): string {
  const s = String(raw ?? "60").trim();
  return /^\d+$/.test(s) ? s : "60";
}

function asAssets(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((a) => String(a)).filter(Boolean) : ["BTC", "ETH"];
}

function kindLabel(kind: unknown): "BUY_YES" | "BUY_NO" {
  const n = Number(kind);
  if (kind === 2 || kind === "2" || kind === "BUY_NO" || kind === 1 || kind === "1" || kind === "SELL_YES") {
    return "BUY_NO";
  }
  if (kind === 3 || kind === "3" || kind === "SELL_NO") return "BUY_YES";
  if (n === 2 || n === 1) return "BUY_NO";
  return "BUY_YES";
}

function persistKind(kind: unknown): "BUY_YES" | "BUY_NO" | "SELL_YES" | "SELL_NO" {
  const n = Number(kind);
  if (kind === 1 || kind === "1" || kind === "SELL_YES" || n === 1) return "SELL_YES";
  if (kind === 3 || kind === "3" || kind === "SELL_NO" || n === 3) return "SELL_NO";
  return kindLabel(kind);
}

function kindNumber(kind: unknown): number {
  return kindLabel(kind) === "BUY_NO" ? 2 : 0;
}

const SHANNON_UNIT = 1_000_000n;

function entryCostRaw(kind: unknown, price: string, filled: string): string {
  return collateralCostForKind(kindNumber(kind), BigInt(price), BigInt(filled), SHANNON_UNIT).toString();
}

export async function reconcileOnce(account: LocalAccount): Promise<{ action: string; runnerId?: string }> {
  assertShannonExecution();
  const doctor = await runDoctor({ skipTooling: true });
  if (protocolChecksFailed(doctor.checks) || doctor.failClosed && doctor.checks.some((c) => c.id.startsWith("shannon.") && c.status === "FAIL")) {
    log("doctor_block", { failClosed: doctor.failClosed });
    return { action: "doctor_block" };
  }

  const claimed = await claimRunner();
  if (!claimed) {
    log("no_lease", {});
    return { action: "no_lease" };
  }
  const vault = claimed.vault as Address;
  let snap = await readVaultSnapshot(vault);
  await ensureRunner({
    vault,
    owner: snap.owner,
    operator: snap.operator,
  });
  const runner = claimed;
  let state = claimed.state as RunnerState;
  async function go(to: RunnerState, extra?: Parameters<typeof setRunnerState>[2]): Promise<void> {
    const hops = shortestPath(state, to);
    if (hops.length === 0) {
      await setRunnerState(runner.id, to, extra);
      return;
    }
    for (let i = 0; i < hops.length; i++) {
      const hop = hops[i];
      await setRunnerState(runner.id, hop, i === hops.length - 1 ? extra : {});
      state = hop;
    }
  }

  try {
    if (snap.killed) {
      await go("KILLED", { lastError: "vault killed on-chain" });
      log("killed", { vault, runnerId: runner.id });
      return { action: "killed", runnerId: runner.id };
    }
    const dailyLoss = BigInt(snap.realizedLossToday || "0");
    const dailyCap = BigInt(snap.maxDailyLoss || "0");
    if (dailyCap > 0n && dailyLoss > dailyCap) {
      await go("ERROR", { lastError: "daily_loss_exceeded" });
      log("parked_daily_loss", {
        vault,
        runnerId: runner.id,
        realizedLossToday: snap.realizedLossToday,
        maxDailyLoss: snap.maxDailyLoss,
      });
      return { action: "parked_daily_loss", runnerId: runner.id };
    }
    if (snap.operator.toLowerCase() !== account.address.toLowerCase()) {
      log("operator_mismatch", { vault, operator: snap.operator, runnerId: runner.id });
      return { action: "operator_mismatch", runnerId: runner.id };
    }

    const proof = await listProof(runner.id);
    const lastOrder = proof.orders.at(-1) as
      | {
          market_id: string;
          fill_class: string;
          tx_hash: string;
          lap_index: number;
          price?: string;
          filled?: string;
          kind?: string;
        }
      | undefined;
    const lastSettle = proof.settlements.at(-1) as
      | { market_id: string; redeem_tx: string | null; resolved?: boolean; voided?: boolean }
      | undefined;

    const missingProof = settlementsMissingProofTx(
      proof.settlements as Array<{
        market_id: string;
        redeem_tx: string | null;
        resolved?: boolean;
        voided?: boolean;
        lap_index: number;
      }>,
    );
    for (const row of missingProof) {
      try {
        const hash = await readLapSettledProofTx(vault, row.market_id as Hex);
        if (!hash) continue;
        const patched = await patchSettlementProofTx(runner.id, Number(row.lap_index), hash);
        log("settlement_proof_backfill", {
          runnerId: runner.id,
          lapIndex: row.lap_index,
          marketId: row.market_id,
          redeemTx: hash,
          patched,
        });
      } catch (e) {
        log("settlement_proof_backfill_failed", {
          runnerId: runner.id,
          lapIndex: row.lap_index,
          message: (e as Error).message.slice(0, 200),
        });
      }
    }

    const needsSettle = filledOrderNeedsSettle(lastOrder, lastSettle);

    if (needsSettle && lastOrder) {
      const alreadyWaited = runner.last_error === "waiting_reactivity";
      await go("WAITING_SETTLEMENT", {
        lastMarketId: lastOrder.market_id,
        lastError: runner.last_error,
      });
      const settlement = await settleFilledMarket(account, lastOrder.market_id as Hex, {
        vault,
        alreadyWaited,
      });
      if (!settlement.settled) {
        let openPrice: string | null = null;
        let closePrice: string | null = null;
        let oracleQuestionId: string | null = null;
        try {
          const meta = await marketOracleMeta(lastOrder.market_id);
          openPrice = meta.open != null ? String(meta.open) : null;
          closePrice = meta.close != null ? String(meta.close) : null;
          oracleQuestionId = meta.oracleQuestionId;
        } catch {
          /* indexer optional */
        }
        const waitingReactivity = Boolean(settlement.waitingReactivity);
        const needsApproval = Boolean(settlement.needsOutcomeApproval);
        const lastError = waitingReactivity
          ? "waiting_reactivity"
          : needsApproval
            ? "needs_outcome_approval"
            : "settlement_pending";
        await go("WAITING_SETTLEMENT", {
          lastMarketId: lastOrder.market_id,
          lastError,
        });
        await persistWorkerStep({
          runnerId: runner.id,
          vault,
          lapIndex: lastOrder.lap_index,
          marketId: lastOrder.market_id,
          correlationId: `settle-wait:${lastOrder.tx_hash}`,
          state: "WAITING_SETTLEMENT",
          openPrice,
          closePrice,
          oracleQuestionId,
        });
        log("settlement_pending", {
          runnerId: runner.id,
          marketId: lastOrder.market_id,
          waitingReactivity,
          needsOutcomeApproval: needsApproval,
          fromCallback: Boolean(settlement.fromCallback),
        });
        return {
          action: waitingReactivity
            ? "waiting_reactivity"
            : needsApproval
              ? "needs_outcome_approval"
              : "settlement_pending",
          runnerId: runner.id,
        };
      }
      const chargesBefore = Number(snap.shieldCharges ?? 0);
      const nextState: RunnerState = settlement.voided
        ? "SETTLED_VOID"
        : settlement.outcome === "loss"
          ? "SETTLED_LOSS"
          : settlement.redeemed
            ? "REDEEMED"
            : "SETTLED_WIN";
      snap = await readVaultSnapshot(vault);
      const shielded =
        nextState === "SETTLED_LOSS" && Number(snap.shieldCharges ?? 0) < chargesBefore;
      if (
        (nextState === "SETTLED_WIN" || nextState === "REDEEMED") &&
        Number(snap.shieldsMax ?? 0) > 0 &&
        Number(snap.shieldCharges ?? 0) < Number(snap.shieldsMax ?? 0)
      ) {
        await refillVaultShield(account, vault);
        snap = await readVaultSnapshot(vault);
      }
      const entryCost =
        lastOrder.price && lastOrder.filled
          ? entryCostRaw(lastOrder.kind, lastOrder.price, lastOrder.filled)
          : null;
      const redeemValue = (
        BigInt(settlement.vaultCollateralAfter) - BigInt(settlement.vaultCollateralBefore)
      ).toString();
      let openPrice: string | null = null;
      let closePrice: string | null = null;
      let oracleQuestionId: string | null = null;
      try {
        const meta = await marketOracleMeta(lastOrder.market_id);
        openPrice = meta.open != null ? String(meta.open) : null;
        closePrice = meta.close != null ? String(meta.close) : null;
        oracleQuestionId = meta.oracleQuestionId;
      } catch {
        /* indexer optional */
      }
      await persistWorkerStep({
        runnerId: runner.id,
        vault,
        lapIndex: lastOrder.lap_index,
        marketId: lastOrder.market_id,
        correlationId: `settle:${lastOrder.tx_hash}`,
        state: nextState,
        entryCost,
        redeemValue,
        pnl:
          entryCost != null
            ? (BigInt(redeemValue) - BigInt(entryCost)).toString()
            : null,
        shielded,
        openPrice,
        closePrice,
        oracleQuestionId,
        settlement: {
          resolved: settlement.resolved,
          voided: settlement.voided,
          payoutNumerators: settlement.payoutNumerators,
          redeemTx: settlement.redeemTx ?? settlement.syncVaultTx,
        },
      });
      await go(nextState, { lastMarketId: lastOrder.market_id });
      log("settled", {
        runnerId: runner.id,
        marketId: lastOrder.market_id,
        outcome: settlement.outcome,
        settled: settlement.settled,
        redeemed: settlement.redeemed,
        redeemTx: settlement.redeemTx,
        fromCallback: Boolean(settlement.fromCallback),
        syncVaultTx: settlement.syncVaultTx,
      });
      const pnlRaw =
        entryCost != null ? (BigInt(redeemValue) - BigInt(entryCost)).toString() : null;
      void sendTelegram(
        telegramLapText({
          vault,
          lapIndex: lastOrder.lap_index,
          state: nextState,
          pnlRaw,
          shielded,
          intervalSec: runner.interval_sec,
          fillTx: lastOrder.tx_hash,
          redeemTx: settlement.redeemTx ?? settlement.syncVaultTx,
          fromCallback: Boolean(settlement.fromCallback),
        }),
      ).catch((e) =>
        log("telegram_failed", { message: (e as Error).message.slice(0, 200) }),
      );
      snap = await readVaultSnapshot(vault);
      if (snap.killed) {
        await go("KILLED", { lastError: "vault killed on-chain" });
        return { action: "killed", runnerId: runner.id };
      }
    }

    await go("DISCOVERING");
    const skip = lastOrder?.market_id ? [lastOrder.market_id] : [];
    const history = await listLaps(runner.id);
    let targetStakeRaw = 0n;
    try {
      targetStakeRaw = policyStakeRaw({
        vaultBal: BigInt(snap.vaultBal),
        perWindowCap: BigInt(snap.perWindowCap || snap.vaultBal),
        streak: streakCurrent(history),
      });
    } catch (e) {
      await go("ERROR", { lastError: (e as Error).message.slice(0, 500) });
      return { action: "stake_unavailable", runnerId: runner.id };
    }
    const placed = await runLiveOrder(account, {
      intervalSec: asIntervalSec(runner.interval_sec),
      bias: asBias(runner.bias),
      assets: asAssets(runner.assets),
      iocOnly: BigInt(snap.outstandingNotional || "0") > 0n,
      skipMarketIds: skip,
      waitMs: 90_000,
      evidenceName: "shannon-worker-order.json",
      vault,
      targetStakeRaw,
      minRemainingFrac: 0.4,
    });
    const attempt = placed.ioc ?? placed.postOnly;
    if (!attempt) {
      await go("ERROR", { lastError: "no attempt" });
      return { action: "no_attempt", runnerId: runner.id };
    }
    const filled = attempt.fillClass === "FILL" || attempt.fillClass === "PARTIAL_FILL";
    const nextIndex = (lastOrder?.lap_index ?? 0) + 1;
    const kind = persistKind(attempt.kind);
    let openPrice: string | null = null;
    let oracleQuestionId: string | null = null;
    try {
      const meta = await marketOracleMeta(attempt.marketId);
      openPrice = meta.open != null ? String(meta.open) : null;
      oracleQuestionId = meta.oracleQuestionId;
    } catch {
      /* indexer optional */
    }
    await persistWorkerStep({
      runnerId: runner.id,
      vault,
      lapIndex: nextIndex,
      marketId: attempt.marketId,
      pool: attempt.pool,
      correlationId: attempt.correlationId,
      state: filled ? "FILLED" : attempt.placedEvent ? "ORDER_SUBMITTED" : "DISCOVERING",
      asset: placed.asset ?? null,
      intervalSec: placed.intervalSec ?? null,
      entryCost: filled
        ? entryCostRaw(kindLabel(attempt.kind), attempt.price, attempt.filled)
        : null,
      openPrice,
      oracleQuestionId,
      order: {
        attemptId: attempt.correlationId,
        txHash: attempt.placeTx,
        orderId: attempt.orderId,
        orderType: attempt.orderType,
        kind,
        price: attempt.price,
        quantity: attempt.quantity,
        filled: attempt.filled,
        fillClass: attempt.fillClass,
        receiptStatus: attempt.placeStatus,
      },
    });
    await go(filled ? "FILLED" : "ORDER_SUBMITTED", {
      lastMarketId: attempt.marketId,
      bumpLap: true,
    });
    if (filled) {
      const sub = await registerMarketSubscription(account, vault, attempt.marketId);
      log("reactivity_register", {
        runnerId: runner.id,
        marketId: attempt.marketId,
        tx: sub.tx,
        subscriptionId: sub.subscriptionId,
        skipped: sub.skipped,
      });
    }
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
    const daily =
      msg.includes("DailyLossExceeded") || /realizedLossToday/.test(msg);
    if (msg.includes("no live Trading market")) {
      await go("DISCOVERING", { lastError: "waiting_book" });
      log("waiting_book", { runnerId: runner.id, error: msg.slice(0, 200) });
      return { action: "waiting_book", runnerId: runner.id };
    }
    await go("ERROR", { lastError: (daily ? "daily_loss_exceeded" : msg).slice(0, 500) });
    log("error", { runnerId: runner.id, error: msg, parked: daily });
    return { action: daily ? "parked_daily_loss" : "error", runnerId: runner.id };
  } finally {
    await releaseRunner(runner.id);
  }
}

export async function runWorkerLoop(account: LocalAccount, opts: { once?: boolean; intervalMs?: number } = {}) {
  const intervalMs = opts.intervalMs ?? 15_000;
  for (;;) {
    const deadline = Date.now() + 25_000;
    try {
      while (Date.now() < deadline) {
        const out = await reconcileOnce(account);
        log("tick", out);
        if (out.action === "no_lease" || out.action === "doctor_block") break;
        if (out.action === "filled" || out.action === "placed" || out.action === "no_attempt") break;
      }
    } catch (e) {
      log("tick_error", { error: (e as Error).message });
    }
    if (opts.once) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
