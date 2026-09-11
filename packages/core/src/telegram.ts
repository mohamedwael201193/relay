import { envString } from "./env.js";

export type TelegramLapNotice = {
  vault: string;
  lapIndex: number;
  state: string;
  pnlRaw?: string | null;
  shielded?: boolean;
  asset?: string | null;
  intervalSec?: string | number | null;
  fillTx?: string | null;
  redeemTx?: string | null;
  fromCallback?: boolean;
};

function shortAddr(addr: string): string {
  const a = addr.trim();
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function tUsdc(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "—";
  const n = Number(raw) / 1e6;
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function cadence(intervalSec: string | number | null | undefined): string {
  const n = Number(intervalSec);
  if (n === 60) return "1m";
  if (n === 300 || n === 298) return "5m";
  if (n === 3600) return "1h";
  if (n === 900) return "15m";
  return Number.isFinite(n) && n > 0 ? `${n}s` : "";
}

/** Receipt-backed Telegram body. Never invents PnL or a fill. */
export function telegramLapText(n: TelegramLapNotice): string {
  const pnl = tUsdc(n.pnlRaw);
  const cad = cadence(n.intervalSec);
  const asset = (n.asset ?? "").toUpperCase();
  const head =
    n.state === "SETTLED_VOID"
      ? `Lap ${n.lapIndex} voided — stake returned`
      : n.shielded
        ? `Lap ${n.lapIndex} shield absorbed ${pnl}`
        : n.state === "REDEEMED" || n.state === "SETTLED_WIN"
          ? `Lap ${n.lapIndex} complete ${pnl}`
          : `Lap ${n.lapIndex} ${n.state.replaceAll("_", " ").toLowerCase()} ${pnl}`;
  const lines = [
    `RELAY · ${head}`,
    `vault ${shortAddr(n.vault)}${asset ? ` · ${asset}` : ""}${cad ? ` ${cad}` : ""}`,
  ];
  if (n.fromCallback) lines.push("Reactivity callback settled this lap");
  if (n.fillTx) lines.push(`fill ${n.fillTx}`);
  if (n.redeemTx) lines.push(`claim ${n.redeemTx}`);
  lines.push("https://relay-silk-one.vercel.app");
  return lines.join("\n");
}

export async function sendTelegram(
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; skipped: boolean; status?: number }> {
  const token = envString("TELEGRAM_BOT_TOKEN");
  const chat = envString("TELEGRAM_CHAT_ID");
  if (!token || !chat) return { ok: true, skipped: true };
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text,
      disable_web_page_preview: true,
    }),
  });
  return { ok: res.ok, skipped: false, status: res.status };
}
