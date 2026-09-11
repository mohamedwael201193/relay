export const SHANNON_CHAIN_ID = 50312;

/** Public Shannon protocol config. Safe in the browser. Never treat opsVault as the connected user's vault. */
export const SHANNON_PUBLIC = {
  chainId: SHANNON_CHAIN_ID,
  network: "shannon",
  decimals: 6,
  collateral: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
  module: "0x3ecC694Cef705358864a646142ac17A90E29e388",
  oracleHub: "0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b",
  registry: "0xc45689f5d6d0bbd2f87c03a16ead46848d1b2eb0",
  manager: "0x837aab854ed970e1185c674c583fb898be36d889",
  operator: "0xBDfCeE82Bd42FEfA58ee850B3709636a8B6b0034",
  opsVault: "0xd762a7719f0e991413038276a37abf7a417d4d59",
  rpcUrl: "https://dream-rpc.somnia.network",
  explorer: "https://shannon-explorer.somnia.network",
  mainnetTradingEnabled: false,
} as const;

export function isOpsVault(vault: string | null | undefined): boolean {
  return Boolean(vault && vault.toLowerCase() === SHANNON_PUBLIC.opsVault.toLowerCase());
}

export const DEFAULT_DRAFT = {
  bias: "FOLLOW" as const,
  budget: 100,
  stopLoss: 30,
  baseStakePct: 0.06,
  streakMultiplier: 0.09,
  maxStakePct: 0.1,
  cadence: "15m" as const,
  assets: ["BTC", "ETH"] as ("BTC" | "ETH")[],
  shieldsMax: 2,
  headroomGatePct: 0.6,
};

export const EMPTY_BOOK = {
  bidUp: [],
  askUp: [],
  bidDown: [],
  askDown: [],
  spread: 0,
};

export const DISCONNECTED_WALLET = {
  address: "",
  network: "Somnia · Shannon testnet",
  chainId: SHANNON_CHAIN_ID,
  tUSDC: 0,
  nativeSTT: 0,
  connected: false,
};

export function explorerTxUrl(hash: string | undefined | null): string | null {
  if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) return null;
  return `${SHANNON_PUBLIC.explorer}/tx/${hash}`;
}

/** Official Somnia oracle graph for this chain's question id. Shannon ids collide on prd.oracle. */
export function oracleQuestionUrl(id: string | undefined | null, chainId = publicEnv().chainId): string | null {
  if (!id || id === "0") return null;
  const host = chainId === SHANNON_CHAIN_ID ? "dev.oracle.somnia.host" : "prd.oracle.somnia.host";
  return `https://${host}/questions/${id}?view=graph`;
}

export function publicEnv() {
  return {
    apiUrl: (process.env.NEXT_PUBLIC_RELAY_API_URL ?? "https://relay-api-71gi.onrender.com").replace(/\/$/, ""),
    privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmtuwy7ib00d30cjpkl8dzpqk",
    network: process.env.NEXT_PUBLIC_NETWORK ?? "shannon",
    chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? SHANNON_CHAIN_ID),
  };
}
