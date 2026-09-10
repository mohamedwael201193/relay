/** Prefer the wallet that matches the active owner; otherwise the first connected wallet. */
export function pickConnectedWallet<T extends { address?: string }>(
  wallets: T[],
  owner?: string,
): T | undefined {
  if (owner) {
    const hit = wallets.find((w) => w.address?.toLowerCase() === owner.toLowerCase());
    if (hit) return hit;
  }
  return wallets[0];
}

/** Resolve the connected EVM address from Privy wallets / linked accounts. */
export function ownerFromPrivy(input: {
  wallets: Array<{ address?: string }>;
  user: {
    wallet?: { address?: string };
    linkedAccounts?: Array<{ type?: string; address?: string }>;
  } | null;
}): string | undefined {
  for (const w of input.wallets) {
    if (isAddress(w.address)) return w.address;
  }
  if (isAddress(input.user?.wallet?.address)) return input.user!.wallet!.address;
  for (const account of input.user?.linkedAccounts ?? []) {
    if (isAddress(account.address)) return account.address;
  }
  return undefined;
}

function isAddress(value: string | undefined): value is string {
  return Boolean(value && /^0x[0-9a-fA-F]{40}$/.test(value));
}
