import { IN_FLIGHT_STATES } from "./activeLap";

export type ListedRunner = { vault: string; state: string; lap_index?: number };

const DEAD_STATES = new Set(["KILLED", "STOPPED"]);
/** Keep Live Lap on a vault that still has a lap in flight (including RE-ARM). */
const HOLD_PICK = new Set<string>([...IN_FLIGHT_STATES, "REARMING"]);

function holdScore(r: ListedRunner): number {
  return Number(r.lap_index) || 0;
}

/** Brand-new vault (no laps yet). Must not steal Live from a sibling still in a lap. */
function isUnarmedBaby(r: ListedRunner): boolean {
  return (r.state === "ACTIVE" || r.state === "DISCOVERING") && !(holdScore(r) > 0);
}

/**
 * Resolve the vault this owner may act on.
 * Never fall back to a leftover store address — that would show Wallet B's
 * runner (or the ops vault) when Wallet C has none.
 * A brand-new child (ACTIVE / DISCOVERING, lap 0) must not steal Live from a
 * sibling still in WAITING_SETTLEMENT / REDEEM / RE-ARM.
 * A hinted parent that is DISCOVERING/ACTIVE with lap_index > 0 is still that
 * runner — do not jump to another in-flight child during RE-ARM.
 */
export function pickOwnedVault(
  listed: ListedRunner[],
  vaultHint?: string | null,
): string | null {
  const rows = listed.filter((r) => r.vault && /^0x[0-9a-fA-F]{40}$/i.test(r.vault));
  const byVault = new Map(rows.map((r) => [r.vault.toLowerCase(), r]));
  const hinted = vaultHint?.toLowerCase() ?? null;
  const holdRows = rows.filter((r) => HOLD_PICK.has(r.state));
  const bestHold = holdRows.length
    ? [...holdRows].sort((a, b) => holdScore(b) - holdScore(a))[0]
    : undefined;
  if (hinted) {
    const hit = byVault.get(hinted);
    if (hit && !DEAD_STATES.has(hit.state) && !isUnarmedBaby(hit)) return hinted;
    if (hit && isUnarmedBaby(hit) && bestHold && bestHold.vault.toLowerCase() !== hinted) {
      return bestHold.vault.toLowerCase();
    }
    if (hit && !DEAD_STATES.has(hit.state)) return hinted;
  }
  if (bestHold) return bestHold.vault.toLowerCase();
  const live =
    rows.find((r) => !DEAD_STATES.has(r.state)) ?? rows.find((r) => r.state !== "KILLED");
  if (live) return live.vault.toLowerCase();
  if (hinted && byVault.has(hinted)) return hinted;
  return rows[0]?.vault.toLowerCase() ?? null;
}

/** A killed or fully stopped vault cannot take deposit/setCaps — CREATE a new one. */
export function selectDeployVault(
  listed: ListedRunner[],
  killedOnChain: Record<string, boolean> = {},
): string | null {
  for (const r of listed) {
    if (!r.vault || !/^0x[0-9a-fA-F]{40}$/i.test(r.vault)) continue;
    const vault = r.vault.toLowerCase();
    if (DEAD_STATES.has(r.state)) continue;
    if (killedOnChain[vault]) continue;
    return vault;
  }
  return null;
}
