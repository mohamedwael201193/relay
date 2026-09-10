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
  deployOwnedVault,
  loadEnv,
  loadShannonDeployment,
  normalizePrivateKey,
  readVaultSnapshot,
  runShannonHarness,
  shortestPath,
  type RunnerState,
} from "@relay/core";
import {
  ensureRunner,
  getRunnerByVault,
  listLaps,
  listProof,
  listRunnersByOwner,
  pingDb,
  setRunnerState,
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
          rpcUrl: process.env.SOMNIA_SHANNON_RPC_URL?.trim() || DEFAULT_SHANNON_RPC,
          explorer: "https://shannon-explorer.somnia.network",
          doctorFailClosed: d.failClosed,
          doctorAt: d.generatedAt,
          mainnetTradingEnabled: process.env.MAINNET_TRADING_ENABLED === "true",
        });
        return;
      }
      if (url.pathname === "/v1/markets/live") {
        const harness = await runShannonHarness(8);
        json(res, 200, harness);
        return;
      }
      if (url.pathname === "/v1/arena") {
        const rows = await withPool(async (c) => {
          const r = await c.query(
            `SELECT r.vault, r.owner, r.state, COUNT(s.id) FILTER (WHERE s.resolved AND NOT s.voided) AS verified_laps
             FROM runners r
             LEFT JOIN laps l ON l.runner_id = r.id
             LEFT JOIN settlements s ON s.lap_id = l.id
             GROUP BY r.vault, r.owner, r.state
             ORDER BY verified_laps DESC`,
          );
          return r.rows;
        });
        json(res, 200, {
          runners: rows,
          note: "verified_laps count settlement rows only; streak is not inferred; no synthetic followers",
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
        const existing = (await listRunnersByOwner(auth.owner)).filter(
          (r) => r.state !== "KILLED" && r.state !== "STOPPED",
        );
        if (existing[0]) {
          json(res, 409, { error: "runner_exists", runner: existing[0] });
          return;
        }
        const key = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
        if (!key) {
          json(res, 503, { error: "provision_unavailable" });
          return;
        }
        const budgetUsd = Math.max(1, Number(body.budget) || 100);
        const stopUsd = Math.max(1, Number(body.stopLoss) || 30);
        const unit = 1_000_000n;
        const created = await deployOwnedVault(privateKeyToAccount(key), auth.owner, {
          budget: BigInt(Math.round(budgetUsd * 1e6)),
          perWindowCap: BigInt(Math.round(budgetUsd * 1e6)),
          maxDailyLoss: BigInt(Math.round(stopUsd * 1e6)),
          maxOutstanding: BigInt(Math.round(budgetUsd * 1e6)),
        });
        const row = await ensureRunner({
          vault: created.vault,
          owner: auth.owner,
          operator: "0x0000000000000000000000000000000000000000",
        });
        json(res, 200, { runner: row, deployTx: created.tx, vault: created.vault });
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
          json(res, 200, { runner: row, laps: await listLaps(row.id) });
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
              row.state === "FILLED" || row.state === "WAITING_SETTLEMENT" ? "settle" : "discover",
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
