import { loadEnv, writeEvidence } from "@relay/core";

loadEnv();

const API = "https://api.render.com/v1";
const serviceId = process.argv[2] || process.env.RENDER_SERVICE_ID?.trim();
const publicUrl = process.argv[3] || process.env.RENDER_URL?.trim();
if (!serviceId) throw new Error("service id required");

async function renderFetch(path: string): Promise<{ status: number; body: unknown }> {
  const key = process.env.RENDER_API_KEY?.trim();
  if (!key) throw new Error("RENDER_API_KEY missing");
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { unparsed: true };
  }
  return { status: res.status, body };
}

function deployStatus(body: unknown): { id: string | null; status: string | null } {
  const rows = Array.isArray(body) ? body : [];
  const first = rows[0] as { deploy?: { id?: string; status?: string }; id?: string; status?: string } | undefined;
  const d = first?.deploy ?? first;
  return { id: d?.id ?? null, status: d?.status ?? null };
}

const deadline = Date.now() + 12 * 60_000;
let last = "";
let health: { httpStatus: number; ok: boolean | null } | null = null;
while (Date.now() < deadline) {
  const deploys = await renderFetch(`/services/${serviceId}/deploys?limit=5`);
  const d = deployStatus(deploys.body);
  const line = `${d.status ?? "unknown"}`;
  if (line !== last) {
    last = line;
    console.log(JSON.stringify({ event: "deploy", status: d.status, deployId: d.id }));
  }
  if (d.status === "live" && publicUrl) {
    try {
      const res = await fetch(`${publicUrl.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(60_000) });
      const text = await res.text();
      let ok: boolean | null = null;
      try {
        ok = Boolean((JSON.parse(text) as { ok?: boolean }).ok);
      } catch {
        ok = null;
      }
      health = { httpStatus: res.status, ok };
      console.log(JSON.stringify({ event: "health", httpStatus: res.status, ok, bytes: text.length }));
      writeEvidence("shannon-render-health.json", {
        serviceId,
        url: publicUrl,
        deployStatus: d.status,
        health,
      });
      process.exit(res.status === 200 && ok ? 0 : 2);
    } catch (e) {
      console.log(JSON.stringify({ event: "health_wait", error: (e as Error).message }));
    }
  }
  if (d.status === "build_failed" || d.status === "update_failed" || d.status === "canceled" || d.status === "deactivated") {
    writeEvidence("shannon-render-health.json", { serviceId, url: publicUrl ?? null, deployStatus: d.status });
    process.exit(3);
  }
  await new Promise((r) => setTimeout(r, 20_000));
}
writeEvidence("shannon-render-health.json", { serviceId, url: publicUrl ?? null, deployStatus: last, timeout: true, health });
process.exit(4);
