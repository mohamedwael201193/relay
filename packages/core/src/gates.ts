/** Mainnet trading stays gated until Shannon gold e2e + soak + rotated keys. */

export function mainnetTradingEnabled(): boolean {
  return process.env.MAINNET_TRADING_ENABLED === "true";
}

export function assertShannonExecution(): void {
  const net = (process.env.RELAY_NETWORK ?? "shannon").toLowerCase();
  if (net === "mainnet" || net === "5031") {
    throw new Error("mainnet execution is gated: Shannon gold e2e/soak, doctor, and rotated keys required");
  }
  if (mainnetTradingEnabled()) {
    throw new Error("MAINNET_TRADING_ENABLED is set; refuse until the Shannon security gate passes");
  }
}

export function protocolChecksFailed(
  checks: { id: string; status: string }[],
): boolean {
  return checks.some(
    (c) =>
      c.status === "FAIL" &&
      (c.id.startsWith("shannon.") ||
        c.id.startsWith("pkg.") ||
        c.id === "shannon.decimals" ||
        c.id === "db.connect"),
  );
}
