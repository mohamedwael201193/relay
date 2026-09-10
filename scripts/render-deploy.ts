import { loadEnv, writeEvidence } from "@relay/core";

loadEnv();

const API = "https://api.render.com/v1";

type OwnerWrap = { owner?: { id?: string; name?: string; email?: string }; id?: string; name?: string };

async function renderFetch(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const key = process.env.RENDER_API_KEY?.trim();
  if (!key) throw new Error("RENDER_API_KEY missing");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { unparsed: true, length: text.length };
  }
  return { status: res.status, body };
}

function envVar(key: string): { key: string; value: string } | null {
  const value = process.env[key]?.trim();
  if (!value) return null;
  return { key, value };
}

function envList(keys: string[]): { key: string; value: string }[] {
  return keys.map(envVar).filter((v): v is { key: string; value: string } => v != null);
}

async function main() {
  const owners = await renderFetch("/owners");
  const list = Array.isArray(owners.body) ? (owners.body as OwnerWrap[]) : [];
  const ownerId =
    list[0]?.owner?.id ??
    list[0]?.id ??
    (owners.body as { id?: string } | null)?.id;
  if (owners.status >= 400 || !ownerId) {
    writeEvidence("shannon-render-deploy.json", {
      ok: false,
      ownersStatus: owners.status,
      note: "owners lookup failed (key not logged)",
    });
    console.log(JSON.stringify({ ok: false, ownersStatus: owners.status }));
    process.exit(1);
  }

  const existing = await renderFetch("/services?limit=50");
  const services = Array.isArray(existing.body)
    ? (existing.body as { service?: { id: string; name: string; type: string; serviceDetails?: { url?: string } } }[])
    : [];
  const names = new Map(
    services
      .map((row) => row.service ?? (row as unknown as { id: string; name: string }))
      .filter((s) => s && "name" in s)
      .map((s) => [s.name, s]),
  );

  const repo = "https://github.com/mohamedwael201193/relay";
  const branch = process.env.RENDER_BRANCH?.trim() || "feat/shannon-execution";
  const envVars = [
    ...envList([
      "DATABASE_URL",
      "DIRECT_URL",
      "DEPLOYER_PRIVATE_KEY",
      "OPERATOR_PRIVATE_KEY",
      "SOMNIA_SHANNON_RPC_URL",
      "SOMNIA_SHANNON_WS_URL",
      "SOMNIA_MAINNET_RPC_URL",
      "SHANNON_INDEXER_URL",
      "MAINNET_INDEXER_URL",
    ]),
    { key: "RELAY_NETWORK", value: "shannon" },
    { key: "MAINNET_TRADING_ENABLED", value: "false" },
    { key: "NODE_VERSION", value: "20" },
  ];

  async function ensure(name: string, type: "web_service" | "background_worker", startCommand: string, healthCheckPath?: string) {
    const already = names.get(name) as { id?: string; serviceDetails?: { url?: string } } | undefined;
    if (already?.id) {
      return { name, id: already.id, created: false, url: already.serviceDetails?.url ?? null };
    }
    const payload = {
      type,
      name,
      ownerId,
      repo,
      branch,
      autoDeploy: "yes",
      envVars,
      serviceDetails: {
        runtime: "node",
        plan: "starter",
        buildCommand: "pnpm install --frozen-lockfile",
        startCommand,
        ...(healthCheckPath ? { healthCheckPath } : {}),
      },
    };
    const created = await renderFetch("/services", { method: "POST", body: JSON.stringify(payload) });
    const body = created.body as { service?: { id?: string; serviceDetails?: { url?: string } }; id?: string };
    return {
      name,
      id: body.service?.id ?? body.id ?? null,
      created: created.status === 201 || created.status === 200,
      httpStatus: created.status,
      url: body.service?.serviceDetails?.url ?? null,
    };
  }

  const api = await ensure("relay-api", "web_service", "pnpm api", "/health");
  const worker = await ensure("relay-worker", "background_worker", "pnpm worker");

  const evidence = {
    ok: Boolean(api.id && worker.id),
    ownerId,
    repo,
    branch,
    envVarNames: envVars.map((e) => e.key),
    api,
    worker,
    note: "values of secrets are not written; Render restart re-runs the worker which reconciles from Postgres + chain",
  };
  writeEvidence("shannon-render-deploy.json", evidence);
  console.log(JSON.stringify(evidence));
  process.exit(evidence.ok ? 0 : 1);
}

await main();
