import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Hex } from "viem";

function loadFile(name: string, override: boolean): void {
  const p = resolve(process.cwd(), name);
  if (existsSync(p)) loadDotenv({ path: p, override });
}

/** Load gitignored env files. Never log values. */
export function loadEnv(): void {
  loadFile(".env", false);
  loadFile(".env.local", true);
  loadFile(".env.testnet", false);
}

export function normalizePrivateKey(raw: string | undefined): Hex | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) return undefined;
  const hex = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("DEPLOYER_PRIVATE_KEY is present but not 32-byte hex (value not logged)");
  }
  return hex as Hex;
}

export function envString(name: string, fallback?: string): string | undefined {
  const v = process.env[name]?.trim();
  if (v) return v;
  return fallback;
}

export function envPresent(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    if (u.username) u.username = "***";
    return u.toString();
  } catch {
    return "[unparseable-url]";
  }
}
