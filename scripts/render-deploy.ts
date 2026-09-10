import {
  billingRequired,
  loadEnv,
  pickOwner,
  shouldCreateBackgroundWorker,
  webDeploySucceeded,
  writeEvidence,
  type EnsureResult,
  type RenderOwner,
} from "@relay/core";

loadEnv();

const API = "https://api.render.com/v1";

type OwnerWrap = { owner?: RenderOwner; id?: string; name?: string; type?: string };

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

function createError(body: unknown): string {
  if (body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string") {
    return (body as { message: string }).message;
  }
  if (Array.isArray(body)) {
    return body
      .map((row) => (row && typeof row === "object" && "message" in row ? String((row as { message: unknown }).message) : ""))
      .filter(Boolean)
      .join("; ");
  }
  return "create failed";
}

function ownersFrom(body: unknown): RenderOwner[] {
  if (!Array.isArray(body)) return [];
  return (body as OwnerWrap[])
    .map((row) => row.owner ?? { id: row.id ?? "", name: row.name, type: row.type })
    .filter((o) => o.id);
}

async function main() {
  const owners = await renderFetch("/owners");
  const list = ownersFrom(owners.body);
  const preferred = pickOwner(list, process.env.RENDER_OWNER_NAME);
  if (owners.status >= 400 || !preferred?.id) {
    writeEvidence("shannon-render-deploy.json", {
      ok: false,
      ownersStatus: owners.status,
      ownerCount: list.length,
      note: "owners lookup failed (key not logged)",
    });
    console.log(JSON.stringify({ ok: false, ownersStatus: owners.status, ownerCount: list.length }));
    process.exit(1);
  }

  const ownerOrder = [preferred, ...list.filter((o) => o.id !== preferred.id)];

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
    ...envList(["DATABASE_URL", "DIRECT_URL", "DEPLOYER_PRIVATE_KEY", "OPERATOR_PRIVATE_KEY"]),
    { key: "SOMNIA_SHANNON_RPC_URL", value: process.env.SOMNIA_SHANNON_RPC_URL?.trim() || "https://dream-rpc.somnia.network" },
    { key: "SOMNIA_SHANNON_WS_URL", value: process.env.SOMNIA_SHANNON_WS_URL?.trim() || "wss://api.infra.testnet.somnia.network/ws" },
    { key: "SOMNIA_MAINNET_RPC_URL", value: process.env.SOMNIA_MAINNET_RPC_URL?.trim() || "https://api.infra.mainnet.somnia.network" },
    { key: "SHANNON_INDEXER_URL", value: process.env.SHANNON_INDEXER_URL?.trim() || "https://dev.smk.somnia.host/v1/graphql" },
    { key: "MAINNET_INDEXER_URL", value: process.env.MAINNET_INDEXER_URL?.trim() || "https://prd.smk.somnia.host/v1/graphql" },
    { key: "RELAY_NETWORK", value: "shannon" },
    { key: "MAINNET_TRADING_ENABLED", value: "false" },
    { key: "RELAY_RUN_WORKER", value: "true" },
    { key: "NODE_VERSION", value: "20" },
  ];

  async function ensure(
    ownerId: string,
    name: string,
    type: "web_service" | "background_worker",
    startCommand: string,
    healthCheckPath?: string,
  ): Promise<EnsureResult> {
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
        plan: type === "background_worker" ? "starter" : "free",
        region: "oregon",
        envSpecificDetails: {
          buildCommand: "pnpm install --frozen-lockfile --prod=false",
          startCommand,
        },
        ...(healthCheckPath ? { healthCheckPath } : {}),
      },
    };
    const created = await renderFetch("/services", { method: "POST", body: JSON.stringify(payload) });
    const body = created.body as {
      service?: { id?: string; serviceDetails?: { url?: string } };
      id?: string;
      message?: string;
    };
    return {
      name,
      id: body.service?.id ?? body.id ?? null,
      created: created.status === 201 || created.status === 200,
      httpStatus: created.status,
      url: body.service?.serviceDetails?.url ?? null,
      error: created.status >= 400 ? createError(created.body) : null,
    };
  }

  let owner = preferred;
  let api: EnsureResult = { name: "relay-api", id: null };
  for (const candidate of ownerOrder) {
    owner = candidate;
    api = await ensure(candidate.id, "relay-api", "web_service", "pnpm start", "/health");
    if (webDeploySucceeded(api) || !billingRequired(api.httpStatus ?? 0, api.error)) break;
  }
  const worker = shouldCreateBackgroundWorker()
    ? await ensure(owner.id, "relay-worker", "background_worker", "pnpm worker")
    : {
        name: "relay-worker",
        id: null,
        created: false,
        error: "skipped: combined pnpm start on web; set RENDER_CREATE_WORKER=true for a paid worker",
      };

  const ok = webDeploySucceeded(api);
  const evidence = {
    ok,
    ownerId: owner.id,
    ownerName: owner.name ?? null,
    repo,
    branch,
    envVarNames: envVars.map((e) => e.key),
    api,
    worker,
    billingRequired: billingRequired(api.httpStatus ?? 0, api.error),
    note: "secret values are not written; Render restart runs boot_reconcile then SKIP LOCKED worker ticks",
  };
  writeEvidence("shannon-render-deploy.json", evidence);
  console.log(JSON.stringify(evidence));
  process.exit(ok ? 0 : 1);
}

await main();
