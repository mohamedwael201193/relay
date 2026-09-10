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
