import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { formatEther, formatUnits, type Address } from "viem";
import {
  CORE_CONTRACT_KEYS,
  DEFAULT_MAINNET_RPC,
  DEFAULT_SHANNON_INDEXER,
  DEFAULT_SHANNON_RPC,
  EXPECTED_MAINNET_DECIMALS,
  EXPECTED_SHANNON_DECIMALS,
  MAINNET_ADDRESSES,
  MAINNET_CHAIN_ID,
  REACTIVITY_PRECOMPILE,
  SHANNON_ADDRESSES,
  SHANNON_CHAIN_ID,
} from "./addresses.js";
import { createExchange } from "./exchange.js";
import { envPresent, envString, loadEnv, normalizePrivateKey, redactUrl } from "./env.js";
import { getBinaryBookParamsHttp, getMarketOnchainHttp } from "./onchain.js";
import { codeSize, eip1967Implementation, erc20Balance, erc20Decimals, mainnetClient, shannonClient } from "./rpc.js";

export type CheckStatus = "PASS" | "WARN" | "FAIL";

export type Check = {
  id: string;
  status: CheckStatus;
  detail: string;
};

export type DoctorReport = {
  generatedAt: string;
  sdkVersion: string;
  reactivityVersion: string | null;
  viemVersion: string;
  nodeVersion: string;
  checks: Check[];
  failClosed: boolean;
};

function pkgVersion(name: string): string | null {
  const files = [
    resolve(process.cwd(), "packages/core/node_modules", name, "package.json"),
    resolve(process.cwd(), "node_modules", name, "package.json"),
    resolve(process.cwd(), "node_modules/@relay/core/node_modules", name, "package.json"),
  ];
  for (const file of files) {
    if (!existsSync(file)) continue;
    try {
      const j = JSON.parse(readFileSync(file, "utf8")) as { version?: string };
      if (j.version) return j.version;
    } catch {
      /* ignore */
    }
  }
  const bases = [
    import.meta.url,
    pathToFileURL(resolve(process.cwd(), "packages/core/package.json")).href,
  ];
  for (const base of bases) {
    try {
      return createRequire(base)(`${name}/package.json`).version as string;
    } catch {
      /* try next */
    }
  }
  return null;
}

function add(checks: Check[], id: string, status: CheckStatus, detail: string): void {
  checks.push({ id, status, detail });
}

async function probeGithub(checks: Check[]): Promise<void> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    add(checks, "github.auth", "WARN", "GITHUB_TOKEN not set");
    return;
  }
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "relay-doctor" },
  });
  if (!res.ok) {
    add(checks, "github.auth", "FAIL", `HTTP ${res.status} (token value not logged)`);
    return;
  }
  const body = (await res.json()) as { login?: string };
  add(checks, "github.auth", "PASS", `authenticated as ${body.login ?? "unknown"}`);
}

async function probeRender(checks: Check[]): Promise<void> {
  const key = process.env.RENDER_API_KEY?.trim();
  if (!key) {
    add(checks, "render.auth", "WARN", "RENDER_API_KEY not set");
    return;
  }
  const res = await fetch("https://api.render.com/v1/owners", {
    headers: { Authorization: `Bearer ${key}` },
  });
  add(
    checks,
    "render.auth",
    res.ok ? "PASS" : "FAIL",
    res.ok ? "owners endpoint accepted key" : `HTTP ${res.status} (key not logged)`,
  );
}

async function probeDatabase(checks: Check[]): Promise<void> {
  if (!envPresent("DATABASE_URL")) {
    add(checks, "db.url", "WARN", "DATABASE_URL not set");
    return;
  }
  add(checks, "db.url", "PASS", `present (${redactUrl(process.env.DATABASE_URL!)} host only)`);
  try {
    const { default: pg } = await import("pg");
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 8000,
    });
    await client.connect();
    await client.query("select 1 as ok");
    await client.end();
    add(checks, "db.connect", "PASS", "SELECT 1 succeeded via pooler URL");
  } catch (err) {
    const msg = err instanceof Error ? err.message.replace(/postgresql:\/\/\S+/gi, "postgresql://***") : "connect failed";
    add(checks, "db.connect", "FAIL", msg);
  }
}

export async function runDoctor(): Promise<DoctorReport> {
  loadEnv();
  const checks: Check[] = [];

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  add(
    checks,
    "tool.node",
    nodeMajor >= 20 ? "PASS" : "FAIL",
    `node ${process.versions.node}`,
  );

  const sdkVersion = pkgVersion("@somnia-chain/markets-sdk") ?? "missing";
  const reactivityVersion = pkgVersion("@somnia-chain/reactivity");
  const viemVersion = pkgVersion("viem") ?? "missing";
  add(
    checks,
    "pkg.markets-sdk",
    sdkVersion === "0.29.0" ? "PASS" : sdkVersion === "missing" ? "FAIL" : "WARN",
    `installed ${sdkVersion}; pin 0.29.0`,
  );
  add(
    checks,
    "pkg.reactivity",
    reactivityVersion === "0.2.1" ? "PASS" : reactivityVersion ? "WARN" : "FAIL",
    `installed ${reactivityVersion ?? "missing"}; expected 0.2.1`,
  );
  add(checks, "pkg.viem", viemVersion.startsWith("2.") ? "PASS" : "FAIL", `installed ${viemVersion}`);

  try {
    const { execSync } = await import("node:child_process");
    const git = execSync("git --version", { encoding: "utf8" }).trim();
    add(checks, "tool.git", "PASS", git);
  } catch {
    add(checks, "tool.git", "FAIL", "git not found");
  }

  try {
    const { execSync } = await import("node:child_process");
    const { existsSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const localForge = resolve(process.cwd(), ".vendor/foundry/forge.exe");
    const cmd = existsSync(localForge) ? `"${localForge}" --version` : "forge --version";
    const forge = execSync(cmd, { encoding: "utf8" }).trim().split("\n")[0];
    add(checks, "tool.forge", "PASS", forge ?? "forge present");
  } catch {
    add(checks, "tool.forge", "FAIL", "forge not on PATH — Foundry required for contract tests");
  }

  await probeGithub(checks);
  await probeRender(checks);
  await probeDatabase(checks);

  const shannonRpc = envString("SOMNIA_SHANNON_RPC_URL", DEFAULT_SHANNON_RPC)!;
  const mainnetRpc = envString("SOMNIA_MAINNET_RPC_URL", DEFAULT_MAINNET_RPC)!;

  const sh = shannonClient(shannonRpc);
  const mn = mainnetClient(mainnetRpc);

  try {
    const id = await sh.getChainId();
    add(
      checks,
      "shannon.chainId",
      id === SHANNON_CHAIN_ID ? "PASS" : "FAIL",
      `got ${id}, expected ${SHANNON_CHAIN_ID}`,
    );
    const block = await sh.getBlockNumber();
    add(checks, "shannon.rpc", "PASS", `head ${block}`);
  } catch (err) {
    add(checks, "shannon.rpc", "FAIL", err instanceof Error ? err.message : "rpc failed");
  }

  try {
    const id = await mn.getChainId();
    add(
      checks,
      "mainnet.chainId",
      id === MAINNET_CHAIN_ID ? "PASS" : "FAIL",
      `got ${id}, expected ${MAINNET_CHAIN_ID}`,
    );
    const block = await mn.getBlockNumber();
    add(checks, "mainnet.rpc", "PASS", `head ${block}`);
  } catch (err) {
    add(checks, "mainnet.rpc", "FAIL", err instanceof Error ? err.message : "rpc failed");
  }

  const shCol = SHANNON_ADDRESSES.collateral as Address;
  const mnCol = MAINNET_ADDRESSES.collateral as Address;
  try {
    const d = await erc20Decimals(sh, shCol);
    add(
      checks,
      "shannon.decimals",
      d === EXPECTED_SHANNON_DECIMALS ? "PASS" : "FAIL",
      `tUSDC ${shCol} decimals=${d} expected ${EXPECTED_SHANNON_DECIMALS}`,
    );
  } catch (err) {
    add(checks, "shannon.decimals", "FAIL", err instanceof Error ? err.message : "decimals failed");
  }
  try {
    const d = await erc20Decimals(mn, mnCol);
    add(
      checks,
      "mainnet.decimals",
      d === EXPECTED_MAINNET_DECIMALS ? "PASS" : "FAIL",
      `USDso ${mnCol} decimals=${d} expected ${EXPECTED_MAINNET_DECIMALS}`,
    );
  } catch (err) {
    add(checks, "mainnet.decimals", "FAIL", err instanceof Error ? err.message : "decimals failed");
  }

  for (const key of CORE_CONTRACT_KEYS) {
    const addr = SHANNON_ADDRESSES[key] as Address | undefined;
    if (!addr) {
      add(checks, `shannon.addr.${key}`, "FAIL", "missing in SDK 0.29.0 pin");
      continue;
    }
    try {
      const size = await codeSize(sh, addr);
      const impl = await eip1967Implementation(sh, addr);
      add(
        checks,
        `shannon.addr.${key}`,
        size > 0 ? "PASS" : "FAIL",
        `${addr} code=${size}B${impl ? ` impl=${impl}` : ""}`,
      );
    } catch (err) {
      add(checks, `shannon.addr.${key}`, "FAIL", err instanceof Error ? err.message : "getCode failed");
    }
  }

  try {
    const size = await codeSize(sh, REACTIVITY_PRECOMPILE);
    add(
      checks,
      "shannon.precompile",
      "PASS",
      `${REACTIVITY_PRECOMPILE} getCode=${size}B (empty bytecode is normal for some precompiles)`,
    );
  } catch (err) {
    add(checks, "shannon.precompile", "WARN", err instanceof Error ? err.message : "precompile probe failed");
  }

  try {
    const exchange = createExchange("shannon");
    const live = await exchange.client.listLiveBinaryMarkets({ limit: 50 });
    if (live.length === 0) {
      add(checks, "shannon.venues", "FAIL", "listLiveBinaryMarkets returned 0 rows");
    } else {
      const venues = [...new Set(live.map((m) => m.venueId).filter(Boolean))];
      add(
        checks,
        "shannon.venues",
        venues.length > 0 ? "PASS" : "FAIL",
        `${live.length} live binaries, ${venues.length} venueId(s) in sample`,
      );
      const candidate = live.find((m) => m.poolAddress && m.marketId) ?? live[0];
      if (candidate?.poolAddress && candidate.marketId) {
        const onchain = await getMarketOnchainHttp(
          sh,
          SHANNON_ADDRESSES.binaryModule as Address,
          candidate.marketId,
        );
        add(
          checks,
          "shannon.marketOnchain",
          onchain.status === 1 || onchain.status === 0 ? "PASS" : "WARN",
          `${candidate.marketId.slice(0, 10)}… status=${onchain.statusLabel} pool=${onchain.pool} nonce=${onchain.nonce} voidPolicy=${onchain.voidPolicy} decimals=${onchain.decimals}`,
        );
        const book = await getBinaryBookParamsHttp(sh, onchain.pool);
        add(
          checks,
          "shannon.bookParams",
          book.tickSize > 0n && book.lotSize > 0n && book.minQuantity > 0n ? "PASS" : "FAIL",
          `tick=${book.tickSize} lot=${book.lotSize} minQty=${book.minQuantity}`,
        );
        const fees = await exchange.client.getMarketFees(candidate.marketId);
        add(
          checks,
          "shannon.fees",
          fees ? "PASS" : "WARN",
          fees ? JSON.stringify(fees, (_k, v) => (typeof v === "bigint" ? v.toString() : v)) : "getMarketFees returned null",
        );
      }
    }
  } catch (err) {
    add(checks, "shannon.indexer", "FAIL", err instanceof Error ? err.message : "indexer/sdk failed");
  }

  const key = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY ?? process.env.OPERATOR_PRIVATE_KEY);
  if (!key) {
    add(checks, "wallet", "WARN", "no deployer/operator key in env (presence only)");
  } else {
    const account = privateKeyToAccount(key);
    try {
      const native = await sh.getBalance({ address: account.address });
      const tusdc = await erc20Balance(sh, shCol, account.address);
      add(
        checks,
        "wallet.shannon",
        native > 0n ? "PASS" : "WARN",
        `${account.address} STT=${formatEther(native)} tUSDC=${formatUnits(tusdc, EXPECTED_SHANNON_DECIMALS)}`,
      );
    } catch (err) {
      add(checks, "wallet.shannon", "FAIL", err instanceof Error ? err.message : "balance failed");
    }
  }

  if (!envString("SHANNON_INDEXER_URL", DEFAULT_SHANNON_INDEXER)) {
    add(checks, "shannon.indexerUrl", "FAIL", "indexer URL missing");
  }

  const failClosed = checks.some((c) => c.status === "FAIL");
  const report: DoctorReport = {
    generatedAt: new Date().toISOString(),
    sdkVersion,
    reactivityVersion,
    viemVersion,
    nodeVersion: process.versions.node,
    checks,
    failClosed,
  };

  const evidenceDir = resolve(process.cwd(), "docs/evidence");
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(resolve(evidenceDir, "doctor-latest.json"), JSON.stringify(report, null, 2));
  return report;
}

export function printDoctor(report: DoctorReport): void {
  for (const c of report.checks) {
    console.log(`${c.status.padEnd(4)} ${c.id} — ${c.detail}`);
  }
  console.log(`failClosed=${report.failClosed} sdk=${report.sdkVersion} node=${report.nodeVersion}`);
}
