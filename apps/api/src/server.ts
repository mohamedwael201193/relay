import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EXPECTED_SHANNON_DECIMALS,
  SHANNON_CHAIN_ID,
  loadEnv,
  loadShannonDeployment,
  runShannonHarness,
} from "@relay/core";
import { getRunnerByVault, listLaps, listProof, pingDb, setRunnerState, withPool } from "@relay/db";

loadEnv();

const port = Number(process.env.PORT ?? 8787);
const dep = (() => {
  try {
    return loadShannonDeployment();
  } catch {
    return null;
  }
})();

function json(res: import("node:http").ServerResponse, status: number, body: unknown): void {
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

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  try {
    if (url.pathname === "/health") {
      await pingDb();
      json(res, 200, {
        ok: true,
        service: "relay-api",
        chainId: SHANNON_CHAIN_ID,
        db: true,
      });
      return;
    }
    if (url.pathname === "/v1/network") {
      const d = doctorSummary();
      json(res, 200, {
        chainId: SHANNON_CHAIN_ID,
        decimals: EXPECTED_SHANNON_DECIMALS,
        vault: dep?.vault ?? null,
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
          `SELECT r.vault, r.state, COUNT(s.id) FILTER (WHERE s.resolved AND NOT s.voided) AS verified_laps
           FROM runners r
           LEFT JOIN laps l ON l.runner_id = r.id
           LEFT JOIN settlements s ON s.lap_id = l.id
           GROUP BY r.vault, r.state
           ORDER BY verified_laps DESC`,
        );
        return r.rows;
      });
      json(res, 200, { runners: rows, note: "streaks count only settlement rows, never receipt.status" });
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
    if (url.pathname.startsWith("/v1/runners/")) {
      const parts = url.pathname.split("/").filter(Boolean);
      const vault = parts[2]?.toLowerCase();
      const tail = parts[3];
      if (!vault) {
        json(res, 400, { error: "missing_vault" });
        return;
      }
      const row = await getRunnerByVault(vault);
      if (req.method === "POST" && tail === "start") {
        if (!row) {
          json(res, 404, { error: "not_found" });
          return;
        }
        await setRunnerState(row.id, "ACTIVE");
        json(res, 200, { ok: true, state: "ACTIVE" });
        return;
      }
      if (req.method === "POST" && tail === "stop") {
        if (!row) {
          json(res, 404, { error: "not_found" });
          return;
        }
        await setRunnerState(row.id, "STOPPED");
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
          state: row.state,
          lastMarketId: row.last_market_id,
          lastError: row.last_error,
          nextAction: row.state === "FILLED" || row.state === "WAITING_SETTLEMENT" ? "settle" : "discover",
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
    json(res, 500, { error: "internal", category: (e as Error).name });
  }
});

server.listen(port, () => {
  console.log(JSON.stringify({ listening: port }));
});
