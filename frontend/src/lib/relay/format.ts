/** RELAY — display formatters (financial numbers are sacred; never wing them). */

export function money(v: number, opts?: { sign?: boolean; decimals?: number }) {
  if (!Number.isFinite(v)) return "—";
  const abs0 = Math.abs(v);
  if (abs0 < 5e-7) {
    return opts?.sign ? "+$0.00" : "$0.00";
  }
  const d =
    opts?.decimals ??
    (abs0 > 0 && abs0 < 0.0001 ? 8 : abs0 > 0 && abs0 < 0.01 ? 6 : 2);
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
  const sign = v < 0 ? "−" : opts?.sign ? "+" : "";
  return `${sign}$${abs}`;
}

export function signed(v: number, decimals?: number) {
  return money(v, { sign: true, decimals });
}

export function pct(v: number, decimals = 1) {
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(decimals)}%`;
}

export function signedPct(v: number, decimals = 1) {
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}${(Math.abs(v) * 100).toFixed(decimals)}%`;
}

/** probability quoted like a book price: 0.543 → "54.3¢" */
export function cents(v: number, decimals = 1) {
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(decimals)}¢`;
}

export function countdown(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function countdownMs(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function clock(at: number) {
  if (!Number.isFinite(at) || at <= 0) return "—";
  return new Date(at).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function hhmm(at: number) {
  return new Date(at).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ago(at: number, now: number) {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function duration(at: number, now: number) {
  const m = Math.max(0, Math.floor((now - at) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

export function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function shortHash(h: string) {
  if (!h) return "—";
  if (h.length <= 18) return h;
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

export function contracts(n: number) {
  const abs = Math.abs(n);
  const digits = abs > 0 && abs < 0.01 ? 6 : abs > 0 && abs < 1 ? 4 : 2;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function price(p: number, asset: string) {
  if (!Number.isFinite(p) || p <= 0) return "—";
  if (asset === "ETH") return `$${p.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${p.toLocaleString("en-US", { maximumFractionDigits: 1 })}`;
}

export function delta(v: number) {
  if (v === 0) return "—";
  if (v > 0) return `▲${v}`;
  return `▼${Math.abs(v)}`;
}
