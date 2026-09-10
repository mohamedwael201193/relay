/** Pure helpers for Render deploy decisions. No secrets. */

export type RenderOwner = { id: string; name?: string | null; type?: string | null };

export type EnsureResult = {
  name: string;
  id: string | null;
  created?: boolean;
  httpStatus?: number;
  url?: string | null;
  error?: string | null;
};

export function pickOwner(owners: RenderOwner[], preferName?: string): RenderOwner | null {
  if (!owners.length) return null;
  const want = (preferName ?? "").trim().toLowerCase();
  if (want) {
    const named = owners.find((o) => (o.name ?? "").toLowerCase() === want);
    if (named) return named;
  }
  const hobby = owners.find((o) => (o.name ?? "").toLowerCase() === "relay-shannon");
  if (hobby) return hobby;
  return owners[0] ?? null;
}

export function billingRequired(httpStatus: number, error: string | null | undefined): boolean {
  if (httpStatus === 402) return true;
  return /payment information is required/i.test(error ?? "");
}

/** Combined API+worker process lives on the web service. A worker id is optional. */
export function webDeploySucceeded(api: EnsureResult): boolean {
  if (!api.id) return false;
  if (api.httpStatus != null && api.httpStatus >= 400) return false;
  return true;
}

export function shouldCreateBackgroundWorker(flag = process.env.RENDER_CREATE_WORKER): boolean {
  return flag === "true";
}
