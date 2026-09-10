export type ListedRunner = { vault: string; state: string };

const DEAD_STATES = new Set(["KILLED", "STOPPED"]);

/**
 * Resolve the vault this owner may act on.
 * Never fall back to a leftover store address — that would show Wallet B's
 * runner (or the ops vault) when Wallet C has none.
 */
export function pickOwnedVault(
  listed: ListedRunner[],
  vaultHint?: string | null,
): string | null {
  const rows = listed.filter((r) => r.vault && /^0x[0-9a-fA-F]{40}$/i.test(r.vault));
  const byVault = new Map(rows.map((r) => [r.vault.toLowerCase(), r]));
  const hinted = vaultHint?.toLowerCase() ?? null;
  if (hinted) {
    const hit = byVault.get(hinted);
    if (hit && hit.state !== "KILLED") return hinted;
  }
  const live = rows.find((r) => r.state !== "KILLED");
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
