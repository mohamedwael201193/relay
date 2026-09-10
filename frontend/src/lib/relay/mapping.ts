/**
 * Mock → real mapping (production reads the right-hand source only).
 *
 * mockRunner              → GET /v1/runners/:vault + GET /v1/runners?owner=
 * mockRunner.status       → backend runner.state (see mapBackendState)
 * mockRunner.streak       → consecutive SETTLED_WIN laps from backend history; voids keep the run
 * mockRunner.pnl          → sum of verified lap pnl from history; 0 if unknown
 * mockMarket              → GET /v1/markets/live (DreamDEX harness)
 * mockFill                → proof.orders where fill_class is FILL | PARTIAL_FILL (OrderFilled)
 * mockHistory             → GET /v1/runners/:vault/history + proof
 * mockArena               → GET /v1/arena (vault/owner/state/verified_laps only; no fake followers)
 * mockTransaction         → on-chain receipt hash from wallet / proof.tx_hash
 * mockCountdown           → market expiry from live markets row
 * wallet.tUSDC / STT      → viem balanceOf / getBalance on Shannon
 * DemoPanel / dataset.ts  → isolated mockEngine, unreachable in production builds
 */

import type { LapPhase, RunnerStatus } from "./types";

export function mapBackendState(state: string): { runnerStatus: RunnerStatus; phase: LapPhase | null } {
  switch (state) {
    case "CREATED":
    case "FUNDED":
      return { runnerStatus: "DEPLOYING", phase: "SCAN" };
    case "ACTIVE":
    case "DISCOVERING":
      return { runnerStatus: "RUNNING", phase: "SCAN" };
    case "PREPARING":
      return { runnerStatus: "RUNNING", phase: "ARMED" };
    case "ORDER_SUBMITTED":
      return { runnerStatus: "RUNNING", phase: "ORDER" };
    case "PARTIAL_FILL":
      return { runnerStatus: "RUNNING", phase: "ORDER" };
    case "FILLED":
      return { runnerStatus: "RUNNING", phase: "FILL" };
    case "WAITING_SETTLEMENT":
      return { runnerStatus: "RUNNING", phase: "HOLD" };
    case "SETTLED_WIN":
    case "SETTLED_LOSS":
    case "SETTLED_VOID":
      return { runnerStatus: "RUNNING", phase: "RESULT" };
    case "REDEEMING":
      return { runnerStatus: "RUNNING", phase: "CLAIM" };
    case "REDEEMED":
      return { runnerStatus: "RUNNING", phase: "CLAIM" };
    case "REARMING":
      return { runnerStatus: "RUNNING", phase: "REARM" };
    case "PAUSED":
      return { runnerStatus: "PAUSED", phase: null };
    case "STOPPED":
      return { runnerStatus: "STOPPED", phase: null };
    case "KILLED":
      return { runnerStatus: "STOPPED", phase: null };
    case "ERROR":
      return { runnerStatus: "PARKED", phase: null };
    default:
      return { runnerStatus: "RUNNING", phase: null };
  }
}

export function fillIsVerified(fillClass: string | null | undefined): boolean {
  return fillClass === "FILL" || fillClass === "PARTIAL_FILL";
}
