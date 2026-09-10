import { loadEnv, writeEvidence } from "@relay/core";

loadEnv();

const base = (process.env.RENDER_URL ?? "https://relay-api-71gi.onrender.com").replace(/\/$/, "");
const vault = "0xd762a7719f0e991413038276a37abf7a417d4d59";

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(60_000) });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    body = { length: text.length };
  }
  return { status: res.status, body };
}

const health = await get("/health");
const network = await get("/v1/network");
const arena = await get("/v1/arena");
const runner = await get(`/v1/runners/${vault}`);
const proof = await get(`/v1/runners/${vault}/proof`);

const p = proof.body as {
  runner?: { state?: string; lap_index?: number };
  proof?: { orders?: unknown[]; settlements?: unknown[] };
};

const evidence = {
  at: new Date().toISOString(),
  url: base,
  healthStatus: health.status,
  health: health.body,
  networkStatus: network.status,
  network: network.body,
  arenaStatus: arena.status,
  arena: arena.body,
  runnerStatus: runner.status,
  runner: runner.body,
  proofStatus: proof.status,
  orderCount: p.proof?.orders?.length ?? 0,
  settlementCount: p.proof?.settlements?.length ?? 0,
  state: p.runner?.state ?? null,
  lapIndex: p.runner?.lap_index ?? null,
  note: "live Render soak snapshot; chain remains financial truth",
};
writeEvidence("shannon-render-soak.json", evidence);
console.log(JSON.stringify({
  ok: health.status === 200 && network.status === 200,
  healthStatus: health.status,
  worker: (health.body as { worker?: boolean }).worker ?? null,
  mainnetTradingEnabled: (network.body as { mainnetTradingEnabled?: boolean }).mainnetTradingEnabled ?? null,
  state: evidence.state,
  lapIndex: evidence.lapIndex,
  orderCount: evidence.orderCount,
  settlementCount: evidence.settlementCount,
}));
process.exit(health.status === 200 ? 0 : 2);
