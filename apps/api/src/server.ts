import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  DEFAULT_SHANNON_RPC,
  EXPECTED_SHANNON_DECIMALS,
  SHANNON_ADDRESSES,
  SHANNON_CHAIN_ID,
  aggregateArena,
  attachBoostCounts,
  derivedPnlRaw,
  deployOwnedVault,
  boostViaController,
  boostConfigHash,
  loadEnv,
  loadShannonDeployment,
  normalizePrivateKey,
  readVaultSnapshot,
  runShannonHarness,
  readShannonMarket,
  shortestPath,
  type RunnerState,
} from "@relay/core";
import {
  ensureRunner,
  getRunnerByVault,
  listBoostCounts,
  listLaps,
  listProof,
  listRecentBoosts,
  listRunnersByOwner,
  persistBoost,
  pingDb,
  setRunnerState,
  updateRunnerPolicy,
  withPool,
} from "@relay/db";
import { applyCors, parseCorsOrigins } from "./cors.js";
import { ownerMessage, recoverOwner, sameAddr, timestampFresh, type OwnerAction } from "./ownerAuth.js";

loadEnv();

const dep = (() => {
  try {
    return loadShannonDeployment();
  } catch {
    return null;
  }
})();

const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);

const MARKETS_TTL_MS = 20_000;
let marketsCache: { at: number; body: unknown } | null = null;
let marketsInflight: Promise<unknown> | null = null;

async function liveMarketsPayload(extraId?: string | null): Promise<unknown> {
  if (marketsCache && Date.now() - marketsCache.at < MARKETS_TTL_MS) {
    return mergeExtraMarket(marketsCache.body, extraId);
  }
  if (marketsInflight) {
    const body = await marketsInflight;
    return mergeExtraMarket(body, extraId);
  }
  marketsInflight = runShannonHarness(8)
    .then((body) => {
      marketsCache = { at: Date.now(), body };
      return body;
    })
    .finally(() => {
      marketsInflight = null;
    });
  const body = await marketsInflight;
  return mergeExtraMarket(body, extraId);
}

async function mergeExtraMarket(body: unknown, extraId?: string | null): Promise<unknown> {
  const base = body as { generatedAt: string; count: number; rows: Array<{ marketId: string }> };
  const want = extraId?.trim().toLowerCase();
  if (!want || !want.startsWith("0x") || want.length < 10) return base;
  if (base.rows.some((r) => r.marketId.toLowerCase() === want)) return base;
  const extra = await readShannonMarket(extraId!.trim()).catch(() => null);
  if (!extra) return base;
  const rows = [extra, ...base.rows];
  return { ...base, count: rows.length, rows };
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function doctorSummary(): { failClosed: boolean | null; generatedAt: string | null } {
  const p = resolve(process.cwd(), "docs/evidence/doctor-latest.json");
  if (!existsSync(p)) return { failClosed: null, generatedAt: null };
  try {
    const j = JSON.parse(readFileSync(p, "utf8")) as { failClosed?: boolean; generatedAt?: string };
    return { failClosed: Boolean(j.failClosed), generatedAt: j.generatedAt ?? null };
  } catch {
    return { failClosed: null, generatedAt: null };
  }
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Record<string, unknown>;
}

const CADENCE_SEC: Record<string, string> = { "1m": "60", "5m": "300", "15m": "900", "1h": "3600" };

function parseBias(raw: unknown): "UP" | "DOWN" | "FOLLOW" {
  const s = String(raw ?? "FOLLOW").trim().toUpperCase();
  if (s === "UP" || s === "DOWN" || s === "FOLLOW") return s;
  return "FOLLOW";
}

function parseCadence(body: Record<string, unknown>): string {
  const raw = body.intervalSec ?? body.cadence;
  if (raw == null || raw === "") return "60";
  const v = String(raw).trim();
  if (CADENCE_SEC[v]) return CADENCE_SEC[v];
  if (/^\d+$/.test(v)) return v;
  return "60";
}

function parseAssets(body: Record<string, unknown>): string[] {
  if (body.assets === undefined) return ["BTC", "ETH"];
  if (Array.isArray(body.assets)) {
    return body.assets.map((a) => String(a).trim()).filter(Boolean);
  }
  if (typeof body.assets === "string") {
    return body.assets.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return ["BTC", "ETH"];
}

function parseBoostOf(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(s) ? s : null;
}

async function requireOwner(
  action: OwnerAction,
  vault: string,
  body: Record<string, unknown>,
): Promise<{ owner: Address } | { error: string; status: number }> {
  const timestamp = Number(body.timestamp);
  const signature = String(body.signature ?? "");
  if (!timestampFresh(timestamp) || !signature) {
    return { error: "owner_auth_required", status: 401 };
  }
  const message = ownerMessage(action, vault, timestamp);
  let owner: Address;
  try {
    owner = await recoverOwner(message, signature);
  } catch {
    return { error: "bad_signature", status: 401 };
  }
  if (body.owner && !sameAddr(String(body.owner), owner)) {
    return { error: "owner_mismatch", status: 403 };
  }
  return { owner };
}

export function startApi(listenPort = Number(process.env.PORT ?? 8787)) {
  const server = createServer(async (req, res) => {
    applyCors(req, res, allowedOrigins);
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    res.setHeader("x-relay-request-id", requestId);
    try {
      if (url.pathname === "/health") {
        await pingDb();
        json(res, 200, {
          ok: true,
          service: "relay-api",
          chainId: SHANNON_CHAIN_ID,
          db: true,
          worker: process.env.RELAY_RUN_WORKER === "true",
        });
        return;
      }
      if (url.pathname === "/v1/network") {
        const d = doctorSummary();
        json(res, 200, {
          chainId: SHANNON_CHAIN_ID,
          network: "shannon",
          decimals: EXPECTED_SHANNON_DECIMALS,
          collateral: SHANNON_ADDRESSES.collateral,
          module: SHANNON_ADDRESSES.binaryModule,
          oracleHub: SHANNON_ADDRESSES.oracleHub,
          registry: dep?.registry ?? null,
          manager: dep?.manager ?? null,
          operator: dep?.deployer ?? null,
          opsVault: dep?.vault ?? null,
          vault: dep?.vault ?? null,
          boostController: dep?.boostController ?? null,
          rpcUrl: process.env.SOMNIA_SHANNON_RPC_URL?.trim() || DEFAULT_SHANNON_RPC,
          explorer: "https://shannon-explorer.somnia.network",
          doctorFailClosed: d.failClosed,
          doctorAt: d.generatedAt,
          mainnetTradingEnabled: process.env.MAINNET_TRADING_ENABLED === "true",
        });
        return;
      }
      if (url.pathname === "/v1/markets/live") {
        json(res, 200, await liveMarketsPayload(url.searchParams.get("marketId")));
        return;
      }
      if (url.pathname === "/v1/arena") {
        const joinRows = await withPool(async (c) => {
          const r = await c.query(
            `SELECT r.vault, r.owner, r.state, r.bias, r.interval_sec, r.assets,
                    l.state AS lap_state, l.pnl, l.entry_cost, l.redeem_value, l.created_at, l.shielded
             FROM runners r
             LEFT JOIN laps l ON l.runner_id = r.id
             ORDER BY r.vault, l.lap_index ASC NULLS LAST`,
          );
          return r.rows as Array<{
            vault: string;
            owner: string;
            state: string;
            bias: string | null;
            interval_sec: string | null;
            assets: string[] | null;
            lap_state: string | null;
            pnl: string | null;
            entry_cost: string | null;
            redeem_value: string | null;
            created_at: string | null;
            shielded?: boolean | string | null;
          }>;
        });
        const [boostCounts, recentBoosts] = await Promise.all([
          listBoostCounts().catch(() => ({}) as Record<string, number>),
          listRecentBoosts(24).catch(() => []),
        ]);
        json(res, 200, {
          runners: attachBoostCounts(
            aggregateArena(
              joinRows.map((row) => ({
                vault: row.vault,
                owner: row.owner,
                state: row.state,
                lap_state: row.lap_state,
                pnl: derivedPnlRaw(row.pnl, row.entry_cost, row.redeem_value),
                created_at: row.created_at,
                bias: row.bias,
                interval_sec: row.interval_sec,
                assets: row.assets,
                shielded: row.shielded,
              })),
            ),
            boostCounts,
          ),
          boosts: recentBoosts,
          note: "win_rate = wins/(wins+losses); voids and open excluded; pnl is verified tape; boosters from BoostController graph",
        });
        return;
      }
      if (url.pathname === "/v1/events") {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        res.write(`event: hello\ndata: ${JSON.stringify({ ts: Date.now(), service: "relay-api" })}\n\n`);
        const t = setInterval(() => {
          res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
        }, 15000);
        req.on("close", () => clearInterval(t));
        return;
      }
      if (url.pathname === "/v1/runners" && req.method === "GET") {
        const owner = url.searchParams.get("owner");
        if (!owner) {
          json(res, 400, { error: "missing_owner" });
          return;
        }
        json(res, 200, { runners: await listRunnersByOwner(owner) });
        return;
      }
      if (url.pathname === "/v1/runners" && req.method === "POST") {
        const body = await readJson(req);
        const vault = String(body.vault ?? "").toLowerCase();
        if (!/^0x[0-9a-f]{40}$/.test(vault)) {
          json(res, 400, { error: "bad_vault" });
          return;
        }
        const auth = await requireOwner("register", vault, body);
        if ("error" in auth) {
          json(res, auth.status, { error: auth.error });
          return;
        }
        const snap = await readVaultSnapshot(vault as Address);
        if (!sameAddr(snap.owner, auth.owner)) {
          json(res, 403, { error: "not_vault_owner" });
          return;
        }
        const row = await ensureRunner({
          vault,
          owner: snap.owner,
          operator: snap.operator,
        });
        json(res, 200, { runner: row, snapshot: snap });
        return;
      }
      if (url.pathname === "/v1/runners/provision" && req.method === "POST") {
        const body = await readJson(req);
        const auth = await requireOwner("provision", "new", body);
        if ("error" in auth) {
          json(res, auth.status, { error: auth.error });
          return;
        }
        const boostOf = parseBoostOf(body.boostOf);
        if (boostOf) {
          const leader = await getRunnerByVault(boostOf);
          if (!leader) {
            json(res, 404, { error: "boost_leader_not_found" });
            return;
          }
          if (sameAddr(leader.owner, auth.owner)) {
            json(res, 400, { error: "boost_self" });
            return;
          }
        }
        const existing = (await listRunnersByOwner(auth.owner)).filter(
          (r) => r.state !== "KILLED" && r.state !== "STOPPED",
        );
        if (!boostOf && existing[0]) {
          json(res, 409, { error: "runner_exists", runner: existing[0] });
          return;
        }
        const key = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
        if (!key) {
          json(res, 503, { error: "provision_unavailable" });
          return;
        }
        const budgetUsd = Math.max(1, Number(body.budget) || 100);
        const stopRaw = Number(body.stop ?? body.stopLoss);
        const stopUsd = Math.min(Math.max(1, Number.isFinite(stopRaw) && stopRaw > 0 ? stopRaw : 30), budgetUsd);
        const leader = boostOf ? await getRunnerByVault(boostOf) : null;
        const bias = parseBias(body.bias ?? leader?.bias);
        const intervalSec = parseCadence({
          ...body,
          cadence: body.cadence ?? leader?.interval_sec,
          intervalSec: body.intervalSec ?? leader?.interval_sec,
        });
        const assets = parseAssets(body.assets != null ? body : { assets: leader?.assets });
        const caps = {
          budget: BigInt(Math.round(budgetUsd * 1e6)),
          perWindowCap: BigInt(Math.round(budgetUsd * 1e6)),
          maxDailyLoss: BigInt(Math.round(stopUsd * 1e6)),
          maxOutstanding: BigInt(Math.round(budgetUsd * 1e6)),
        };
        const account = privateKeyToAccount(key);
        let created: { vault: string; tx: string };
        if (boostOf) {
          const controller = dep?.boostController;
          if (!controller) {
            json(res, 503, { error: "boost_controller_missing" });
            return;
          }
          created = await boostViaController(
            account,
            controller,
            boostOf as Address,
            auth.owner,
            boostConfigHash(bias, intervalSec, assets),
            caps,
          );
        } else {
          created = await deployOwnedVault(account, auth.owner, caps);
        }
        const row = await ensureRunner({
          vault: created.vault,
          owner: auth.owner,
          operator: "0x0000000000000000000000000000000000000000",
        });
        const policy = await updateRunnerPolicy(row.id, {
          bias,
          intervalSec,
          assets,
        });
        if (boostOf) {
          await persistBoost({
            leaderVault: boostOf,
            childVault: created.vault,
            owner: auth.owner,
            configHash: boostConfigHash(bias, intervalSec, assets),
            budget: caps.budget.toString(),
            txHash: created.tx,
          });
        }
        json(res, 200, { runner: policy, deployTx: created.tx, vault: created.vault });
        return;
      }
      if (url.pathname.startsWith("/v1/runners/")) {
        const parts = url.pathname.split("/").filter(Boolean);
        const vault = parts[2]?.toLowerCase();
        const tail = parts[3];
        if (!vault) {
          json(res, 400, { error: "missing_vault" });
          return;
        }
        const row = await getRunnerByVault(vault);
        if (req.method === "POST" && (tail === "start" || tail === "stop" || tail === "pause" || tail === "resume")) {
          if (!row) {
            json(res, 404, { error: "not_found" });
            return;
          }
          const body = await readJson(req);
          const auth = await requireOwner(tail, vault, body);
          if ("error" in auth) {
            json(res, auth.status, { error: auth.error });
            return;
          }
          const snap = await readVaultSnapshot(vault as Address);
          if (!sameAddr(snap.owner, auth.owner) || !sameAddr(row.owner, auth.owner)) {
            json(res, 403, { error: "not_vault_owner" });
            return;
          }
          if (tail === "start" || tail === "resume") {
            const hops = shortestPath(row.state as RunnerState, "ACTIVE");
            for (const hop of hops) await setRunnerState(row.id, hop);
            json(res, 200, { ok: true, state: "ACTIVE" });
            return;
          }
          if (tail === "pause") {
            const hops = shortestPath(row.state as RunnerState, "PAUSED");
            for (const hop of hops) await setRunnerState(row.id, hop);
            json(res, 200, { ok: true, state: "PAUSED" });
            return;
          }
          const hops = shortestPath(row.state as RunnerState, "STOPPED");
          for (const hop of hops) await setRunnerState(row.id, hop);
          json(res, 200, { ok: true, state: "STOPPED" });
          return;
        }
        if (!row) {
          json(res, 404, { error: "not_found" });
          return;
        }
        if (tail === "history") {
          const laps = await listLaps(row.id);
          json(res, 200, {
            runner: row,
            laps: laps.map((lap) => ({
              ...lap,
              pnl: derivedPnlRaw(lap.pnl, lap.entry_cost, lap.redeem_value),
            })),
          });
          return;
        }
        if (tail === "proof") {
          json(res, 200, { runner: row, proof: await listProof(row.id) });
          return;
        }
        if (tail === "live") {
          json(res, 200, {
            id: row.id,
            vault: row.vault,
            owner: row.owner,
            operator: row.operator,
            state: row.state,
            lastMarketId: row.last_market_id,
            lastError: row.last_error,
            lapIndex: row.lap_index,
            nextAction:
              row.last_error === "needs_outcome_approval"
                ? "authorize_redeem"
                : row.last_error === "waiting_reactivity"
                  ? "wait_reactivity"
                  : row.state === "FILLED" || row.state === "WAITING_SETTLEMENT"
                    ? "settle"
                    : "discover",
          });
          return;
        }
        if (!tail) {
          json(res, 200, row);
          return;
        }
      }
      json(res, 404, { error: "not_found" });
    } catch (e) {
      json(res, 500, { error: "internal", category: (e as Error).name, requestId });
    }
  });

  server.listen(listenPort, () => {
    console.log(JSON.stringify({ listening: listenPort, worker: process.env.RELAY_RUN_WORKER === "true" }));
  });
  return server;
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? resolve(process.argv[1]) : "";
if (invoked && thisFile.toLowerCase() === invoked.toLowerCase()) {
  startApi();
}
