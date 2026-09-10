/** Explicit origin allow-list. No wildcard in production. */

export const CORS_ALLOW_HEADERS =
  "content-type, authorization, x-relay-owner, x-relay-request-id";


export function parseCorsOrigins(raw: string | undefined): string[] {
  const extra = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "https://relay-silk-one.vercel.app",
  ];
  return [...new Set([...defaults, ...extra])];
}

export function allowOrigin(origin: string | undefined, allowed: string[]): string | null {
  if (!origin) return null;
  if (allowed.includes(origin)) return origin;
  return null;
}

export function applyCors(
  req: { headers: { origin?: string | string[] } },
  res: { setHeader: (k: string, v: string) => void },
  allowed: string[],
): boolean {
  const raw = req.headers.origin;
  const origin = Array.isArray(raw) ? raw[0] : raw;
  const ok = allowOrigin(origin, allowed);
  if (ok) {
    res.setHeader("Access-Control-Allow-Origin", ok);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  return Boolean(ok);
}
