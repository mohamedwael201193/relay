import { loadEnv, writeEvidence } from "@relay/core";

loadEnv();

const API = "https://api.render.com/v1";

async function renderFetch(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const key = process.env.RENDER_API_KEY?.trim();
  if (!key) throw new Error("RENDER_API_KEY missing");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
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

function ownerSummary(body: unknown): unknown {
  if (!Array.isArray(body)) return { rawType: typeof body };
  return body.map((row) => {
    const o = (row as { owner?: Record<string, unknown>; id?: string }).owner ?? row;
    return {
      id: (o as { id?: string }).id ?? null,
      type: (o as { type?: string }).type ?? null,
      name: (o as { name?: string }).name ?? null,
    };
  });
}

function serviceSummary(body: unknown): unknown {
  if (!Array.isArray(body)) return { rawType: typeof body, statusHint: body };
  return body.map((row) => {
    const s = (row as { service?: Record<string, unknown> }).service ?? row;
    return {
      id: (s as { id?: string }).id ?? null,
      name: (s as { name?: string }).name ?? null,
      type: (s as { type?: string }).type ?? null,
      suspended: (s as { suspended?: string }).suspended ?? null,
    };
  });
}

function err(body: unknown): string {
  if (body && typeof body === "object" && "message" in body) return String((body as { message: unknown }).message);
  return "unknown";
}

const owners = await renderFetch("/owners");
const ownerList = ownerSummary(owners.body) as { id: string | null }[];
const ownerId = ownerList[0]?.id;
const services = await renderFetch("/services?limit=50");
const billing = await renderFetch("/billing");
const ownerDetail = ownerId ? await renderFetch(`/owners/${ownerId}`) : { status: 0, body: null };

const probes: Record<string, unknown> = {
  ownersStatus: owners.status,
  owners: ownerList,
  servicesStatus: services.status,
  services: serviceSummary(services.body),
  billingStatus: billing.status,
  billingKeys: billing.body && typeof billing.body === "object" ? Object.keys(billing.body as object) : [],
  ownerDetailStatus: ownerDetail.status,
};

if (ownerId) {
  const webOnly = await renderFetch("/services", {
    method: "POST",
    body: JSON.stringify({
      type: "web_service",
      name: `relay-api-${Date.now().toString().slice(-6)}`,
      ownerId,
      repo: "https://github.com/mohamedwael201193/relay",
      branch: "feat/shannon-execution",
      autoDeploy: "yes",
      serviceDetails: {
        runtime: "node",
        plan: "free",
        region: "oregon",
        envSpecificDetails: {
          buildCommand: "pnpm install --frozen-lockfile --prod=false",
          startCommand: "pnpm api",
        },
        healthCheckPath: "/health",
      },
    }),
  });
  probes.webOnly = { status: webOnly.status, error: webOnly.status >= 400 ? err(webOnly.body) : null, created: webOnly.status < 400 };
}

writeEvidence("shannon-render-probe.json", probes);
console.log(JSON.stringify(probes));
