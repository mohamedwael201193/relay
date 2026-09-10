import { loadEnv, writeEvidence } from "@relay/core";

loadEnv();

const API = "https://api.render.com/v1";
const serviceId = "srv-dah13kjl550s73d4mb20";
const ownerId = "tea-dagvca942hec73e3luog";
const publicUrl = "https://relay-api-71gi.onrender.com";

async function renderFetch(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const key = process.env.RENDER_API_KEY?.trim();
  if (!key) throw new Error("RENDER_API_KEY missing");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      accept: "application/json",
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

function logEvents(body: unknown): string[] {
  const logs = body && typeof body === "object" && "logs" in body ? (body as { logs?: { message?: string }[] }).logs : null;
  const rows = Array.isArray(logs) ? logs : Array.isArray(body) ? (body as { message?: string }[]) : [];
  const events: string[] = [];
  for (const row of rows) {
    const msg = typeof row === "string" ? row : row?.message ?? "";
    const m = msg.match(/"event"\s*:\s*"([^"]+)"/);
    if (m) events.push(m[1]);
    else if (/boot_reconcile/.test(msg)) events.push("boot_reconcile");
  }
  return events;
}

async function publicJson(path: string): Promise<{ status: number; keys: string[] }> {
  const res = await fetch(`${publicUrl}${path}`, { signal: AbortSignal.timeout(60_000) });
  const text = await res.text();
  let keys: string[] = [];
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    keys = Object.keys(j);
  } catch {
    keys = [];
  }
  return { status: res.status, keys };
}

const beforeHealth = await publicJson("/health");
const network = await publicJson("/v1/network");
const logsBefore = await renderFetch(
  `/logs?ownerId=${ownerId}&resource=${serviceId}&limit=50&direction=backward`,
);
const restart = await renderFetch(`/services/${serviceId}/restart`, { method: "POST" });

let afterHealth = { status: 0, keys: [] as string[] };
for (let i = 0; i < 12; i++) {
  await new Promise((r) => setTimeout(r, 10_000));
  try {
    afterHealth = await publicJson("/health");
    if (afterHealth.status === 200) break;
  } catch {
    /* spinning up */
  }
}

const logsAfter = await renderFetch(
  `/logs?ownerId=${ownerId}&resource=${serviceId}&limit=50&direction=backward`,
);

const evidence = {
  url: publicUrl,
  serviceId,
  beforeHealth,
  network,
  restartStatus: restart.status,
  afterHealth,
  logEventsBefore: [...new Set(logEvents(logsBefore.body))],
  logEventsAfter: [...new Set(logEvents(logsAfter.body))],
  logsBeforeStatus: logsBefore.status,
  logsAfterStatus: logsAfter.status,
};
writeEvidence("shannon-render-restart.json", evidence);
console.log(JSON.stringify(evidence));
process.exit(beforeHealth.status === 200 && afterHealth.status === 200 ? 0 : 2);
