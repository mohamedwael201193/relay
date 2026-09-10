import { SHANNON_PUBLIC } from "../config/network";

export type NetworkConfig = {
  chainId: number;
  network: string;
  decimals: number;
  collateral: string;
  module: string;
  oracleHub: string;
  registry: string | null;
  manager: string | null;
  operator: string | null;
  opsVault: string | null;
  rpcUrl: string;
  explorer: string;
  mainnetTradingEnabled: boolean;
};

function str(raw: Record<string, unknown>, key: string, fallback: string): string {
  const value = raw[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/** Accept current and legacy /v1/network payloads. Never enable mainnet. */
export function normalizeNetwork(raw: Record<string, unknown>): NetworkConfig {
  if (raw.mainnetTradingEnabled === true) {
    throw new Error("mainnet trading is off");
  }
  const chainId = Number(raw.chainId ?? SHANNON_PUBLIC.chainId);
  if (chainId !== SHANNON_PUBLIC.chainId) {
    throw new Error(`unsupported chainId ${chainId}`);
  }
  const opsVault =
    str(raw, "opsVault", "") || str(raw, "vault", "") || SHANNON_PUBLIC.opsVault;
  return {
    chainId,
    network: str(raw, "network", SHANNON_PUBLIC.network),
    decimals: Number(raw.decimals ?? SHANNON_PUBLIC.decimals) || SHANNON_PUBLIC.decimals,
    collateral: str(raw, "collateral", SHANNON_PUBLIC.collateral),
    module: str(raw, "module", SHANNON_PUBLIC.module),
    oracleHub: str(raw, "oracleHub", SHANNON_PUBLIC.oracleHub),
    registry: str(raw, "registry", SHANNON_PUBLIC.registry),
    manager: str(raw, "manager", SHANNON_PUBLIC.manager),
    operator: str(raw, "operator", SHANNON_PUBLIC.operator),
    opsVault,
    rpcUrl: str(raw, "rpcUrl", SHANNON_PUBLIC.rpcUrl),
    explorer: str(raw, "explorer", SHANNON_PUBLIC.explorer),
    mainnetTradingEnabled: false,
  };
}

export function publicNetwork(): NetworkConfig {
  return normalizeNetwork({ ...SHANNON_PUBLIC });
}
