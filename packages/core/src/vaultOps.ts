import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  decodeEventLog,
  encodeAbiParameters,
  erc20Abi,
  keccak256,
  parseAbi,
  parseAbiItem,
  parseAbiParameters,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount, type LocalAccount } from "viem/accounts";
import { SHANNON_ADDRESSES, requiredAddress } from "./addresses.js";
import { encodeCreate } from "./sendRealtime.js";
import { assertDeployBudget, sendHttp, shannonHttpClient, somniaCreateGas } from "./sendHttp.js";
import { erc20Balance } from "./rpc.js";

const MODULE = requiredAddress(SHANNON_ADDRESSES.binaryModule, "binaryModule");
const COLLATERAL = requiredAddress(SHANNON_ADDRESSES.collateral, "collateral");
const ORACLE = requiredAddress(SHANNON_ADDRESSES.oracleHub, "oracleHub");

export type ShannonDeployment = {
  chainId: number;
  vault: Address;
  registry: Address;
  manager: Address;
  deployer: Address;
  txs: Hex[];
  boostController?: Address;
};

const vaultAbi = parseAbi([
  "function owner() view returns (address)",
  "function operator() view returns (address)",
  "function killed() view returns (bool)",
  "function collateral() view returns (address)",
  "function budget() view returns (uint256)",
  "function perWindowCap() view returns (uint256)",
  "function priceDecimals() view returns (uint8)",
  "function outstandingNotional() view returns (uint256)",
  "function maxOutstandingNotional() view returns (uint256)",
  "function shieldCharges() view returns (uint8)",
  "function shieldsMax() view returns (uint8)",
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function kill()",
  "function setOperatorNow(address next)",
  "function refillShield()",
]);

const boostAbi = parseAbi([
  "function boost(address leaderVault, address owner_, bytes32 configHash, uint256 budget_, uint256 perWindowCap_, uint256 maxDailyLoss_, uint256 maxOutstanding_) returns (address vault)",
  "function boostCountOf(address leaderVault) view returns (uint256)",
  "function leaderOf(address vault) view returns (address)",
  "function childrenOf(address leaderVault) view returns (address[])",
  "function relayer() view returns (address)",
]);

const boostedEvent = parseAbiItem(
  "event Boosted(address indexed leaderVault, address indexed newVault, address indexed owner, bytes32 configHash, uint256 budget)",
);

/** Config hash cloned onto a boosted vault. Chain stores the hash; Postgres stores the graph. */
export function boostConfigHash(bias: string, intervalSec: string, assets: string[]): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("string, string, string[]"), [bias, intervalSec, assets]),
  );
}

export function loadShannonDeployment(): ShannonDeployment {
  const p = resolve(process.cwd(), "packages/core/src/deployments/shannon.json");
  return JSON.parse(readFileSync(p, "utf8")) as ShannonDeployment;
}

type VaultCreateArtifact = { abi: unknown[]; bytecode: Hex; deployedBytecode: Hex };

function loadVaultCreate(): VaultCreateArtifact {
  const p = resolve(process.cwd(), "packages/core/src/deployments/RunnerVault.create.json");
  return JSON.parse(readFileSync(p, "utf8")) as VaultCreateArtifact;
}

function loadBoostCreate(): VaultCreateArtifact {
  const p = resolve(process.cwd(), "packages/core/src/deployments/BoostController.create.json");
  return JSON.parse(readFileSync(p, "utf8")) as VaultCreateArtifact;
}

export function extractBoostControllerArtifact(): VaultCreateArtifact {
  const src = resolve(process.cwd(), "contracts/out/BoostController.sol/BoostController.json");
  const j = JSON.parse(readFileSync(src, "utf8")) as {
    abi: unknown[];
    bytecode: { object: Hex };
    deployedBytecode: { object: Hex };
  };
  const art: VaultCreateArtifact = {
    abi: j.abi,
    bytecode: j.bytecode.object,
    deployedBytecode: j.deployedBytecode.object,
  };
  writeFileSync(
    resolve(process.cwd(), "packages/core/src/deployments/BoostController.create.json"),
    JSON.stringify(art),
  );
  return art;
}

export async function deployOwnedVault(
  account: LocalAccount,
  owner: Address,
  caps: {
    budget: bigint;
    perWindowCap: bigint;
    maxDailyLoss: bigint;
    maxOutstanding: bigint;
  },
): Promise<{ vault: Address; tx: Hex; gasUsed: string }> {
  const art = loadVaultCreate();
  const data = encodeCreate(art.abi as never, art.bytecode, [
    owner,
    COLLATERAL,
    MODULE,
    ORACLE,
    6,
    caps.budget,
    caps.perWindowCap,
    caps.maxDailyLoss,
    caps.maxOutstanding,
  ]);
  const gas = somniaCreateGas(art.deployedBytecode);
  await assertDeployBudget(account, gas);
  const rcpt = await sendHttp(account, data, { gas });
  if (rcpt.status !== "success" || !rcpt.contractAddress) {
    throw new Error(`owned vault deploy failed hash=${rcpt.transactionHash} status=${rcpt.status}`);
  }
  return { vault: rcpt.contractAddress, tx: rcpt.transactionHash, gasUsed: rcpt.gasUsed.toString() };
}

export async function deployBoostController(
  account: LocalAccount,
): Promise<{ controller: Address; tx: Hex; gasUsed: string }> {
  const art = existsSyncBoostCreate() ? loadBoostCreate() : extractBoostControllerArtifact();
  const data = encodeCreate(art.abi as never, art.bytecode, [
    account.address,
    COLLATERAL,
    MODULE,
    ORACLE,
    6,
  ]);
  const gas = somniaCreateGas(art.deployedBytecode);
  await assertDeployBudget(account, gas);
  const rcpt = await sendHttp(account, data, { gas });
  if (rcpt.status !== "success" || !rcpt.contractAddress) {
    throw new Error(`boost controller deploy failed hash=${rcpt.transactionHash} status=${rcpt.status}`);
  }
  return { controller: rcpt.contractAddress, tx: rcpt.transactionHash, gasUsed: rcpt.gasUsed.toString() };
}

function existsSyncBoostCreate(): boolean {
  try {
    loadBoostCreate();
    return true;
  } catch {
    return false;
  }
}

export function persistBoostControllerPin(controller: Address, tx: Hex, gasUsed: string): void {
  const p = resolve(process.cwd(), "packages/core/src/deployments/shannon.json");
  const cur = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
  if (String(cur.vault).toLowerCase() !== "0xd762a7719f0e991413038276a37abf7a417d4d59") {
    throw new Error("refusing to rewrite shannon.json: ops vault pin moved");
  }
  cur.boostController = controller;
  cur.boostControllerTx = tx;
  cur.boostControllerGasUsed = gasUsed;
  writeFileSync(p, `${JSON.stringify(cur, null, 2)}\n`);
}

/** Relayer-only CREATE of a booster-owned vault. Never the leader's wallet or collateral. */
export async function boostViaController(
  account: LocalAccount,
  controller: Address,
  leaderVault: Address,
  owner: Address,
  configHash: Hex,
  caps: {
    budget: bigint;
    perWindowCap: bigint;
    maxDailyLoss: bigint;
    maxOutstanding: bigint;
  },
): Promise<{ vault: Address; tx: Hex; gasUsed: string }> {
  const { encodeFunctionData } = await import("viem");
  const data = encodeFunctionData({
    abi: boostAbi,
    functionName: "boost",
    args: [
      leaderVault,
      owner,
      configHash,
      caps.budget,
      caps.perWindowCap,
      caps.maxDailyLoss,
      caps.maxOutstanding,
    ],
  });
  const vaultArt = loadVaultCreate();
  const gas = somniaCreateGas(vaultArt.deployedBytecode) + 8_000_000n;
  await assertDeployBudget(account, gas);
  const rcpt = await sendHttp(account, data, { to: controller, gas });
  if (rcpt.status !== "success") {
    throw new Error(`boost failed hash=${rcpt.transactionHash} status=${rcpt.status}`);
  }
  for (const log of rcpt.logs) {
    try {
      const decoded = decodeEventLog({ abi: [boostedEvent], data: log.data, topics: log.topics });
      if (decoded.eventName === "Boosted") {
        return {
          vault: decoded.args.newVault as Address,
          tx: rcpt.transactionHash,
          gasUsed: rcpt.gasUsed.toString(),
        };
      }
    } catch {
      /* other log */
    }
  }
  throw new Error(`boost vault missing hash=${rcpt.transactionHash}`);
}

export async function readVaultSnapshot(vault: Address) {
  const client = shannonHttpClient();
  const [owner, operator, killed, collateral, budget, perWindowCap, priceDecimals, vaultBal, code, outstandingNotional] =
    await Promise.all([
      client.readContract({ address: vault, abi: vaultAbi, functionName: "owner" }),
      client.readContract({ address: vault, abi: vaultAbi, functionName: "operator" }),
      client.readContract({ address: vault, abi: vaultAbi, functionName: "killed" }),
      client.readContract({ address: vault, abi: vaultAbi, functionName: "collateral" }),
      client.readContract({ address: vault, abi: vaultAbi, functionName: "budget" }),
      client.readContract({ address: vault, abi: vaultAbi, functionName: "perWindowCap" }),
      client.readContract({ address: vault, abi: vaultAbi, functionName: "priceDecimals" }),
      erc20Balance(client, COLLATERAL, vault),
      client.getCode({ address: vault }),
      client.readContract({ address: vault, abi: vaultAbi, functionName: "outstandingNotional" }),
    ]);
  let shieldCharges = 0;
  let shieldsMax = 0;
  try {
    shieldCharges = Number(
      await client.readContract({ address: vault, abi: vaultAbi, functionName: "shieldCharges" }),
    );
    shieldsMax = Number(
      await client.readContract({ address: vault, abi: vaultAbi, functionName: "shieldsMax" }),
    );
  } catch {
    /* pre-shield bytecode */
  }
  return {
    owner,
    operator,
    killed,
    collateral,
    budget: budget.toString(),
    perWindowCap: perWindowCap.toString(),
    priceDecimals,
    vaultBal: vaultBal.toString(),
    codeBytes: code && code !== "0x" ? (code.length - 2) / 2 : 0,
    outstandingNotional: outstandingNotional.toString(),
    shieldCharges,
    shieldsMax,
  };
}

export async function fundVault(account: LocalAccount, vault: Address, amount: bigint) {
  const client = shannonHttpClient();
  const token = COLLATERAL;
  const walletBefore = await erc20Balance(client, token, account.address);
  const vaultBefore = await erc20Balance(client, token, vault);

  const { encodeFunctionData } = await import("viem");
  const approveHash = await sendHttp(
    account,
    encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [vault, amount],
    }),
    { to: token, gas: 5_000_000n },
  );
  if (approveHash.status !== "success") {
    throw new Error(`approve failed hash=${approveHash.transactionHash}`);
  }
  const depositHash = await sendHttp(
    account,
    encodeFunctionData({
      abi: vaultAbi,
      functionName: "deposit",
      args: [amount],
    }),
    { to: vault, gas: 5_000_000n },
  );
  if (depositHash.status !== "success") {
    throw new Error(`deposit failed hash=${depositHash.transactionHash}`);
  }

  const walletAfter = await erc20Balance(client, token, account.address);
  const vaultAfter = await erc20Balance(client, token, vault);
  if (vaultAfter - vaultBefore !== amount) {
    throw new Error(`vault accounting mismatch delta=${vaultAfter - vaultBefore} amount=${amount}`);
  }
  if (walletBefore - walletAfter !== amount) {
    throw new Error(`wallet accounting mismatch delta=${walletBefore - walletAfter} amount=${amount}`);
  }
  return {
    approveTx: approveHash.transactionHash,
    depositTx: depositHash.transactionHash,
    walletBefore: walletBefore.toString(),
    walletAfter: walletAfter.toString(),
    vaultBefore: vaultBefore.toString(),
    vaultAfter: vaultAfter.toString(),
    amount: amount.toString(),
  };
}

export async function withdrawVault(account: LocalAccount, vault: Address, amount: bigint) {
  const client = shannonHttpClient();
  const token = COLLATERAL;
  const walletBefore = await erc20Balance(client, token, account.address);
  const vaultBefore = await erc20Balance(client, token, vault);
  const { encodeFunctionData } = await import("viem");
  const rcpt = await sendHttp(
    account,
    encodeFunctionData({ abi: vaultAbi, functionName: "withdraw", args: [amount] }),
    { to: vault, gas: 5_000_000n },
  );
  if (rcpt.status !== "success") {
    throw new Error(`withdraw failed hash=${rcpt.transactionHash}`);
  }
  const walletAfter = await erc20Balance(client, token, account.address);
  const vaultAfter = await erc20Balance(client, token, vault);
  if (vaultBefore - vaultAfter !== amount || walletAfter - walletBefore !== amount) {
    throw new Error("withdraw accounting mismatch");
  }
  return {
    withdrawTx: rcpt.transactionHash,
    walletBefore: walletBefore.toString(),
    walletAfter: walletAfter.toString(),
    vaultBefore: vaultBefore.toString(),
    vaultAfter: vaultAfter.toString(),
  };
}

export async function deployScratchAndKill(account: LocalAccount) {
  const art = JSON.parse(
    readFileSync(resolve(process.cwd(), "contracts/out/RunnerVault.sol/RunnerVault.json"), "utf8"),
  ) as { abi: never; bytecode: { object: Hex }; deployedBytecode: { object: Hex } };
  const data = encodeCreate(art.abi, art.bytecode.object, [
    account.address,
    COLLATERAL,
    MODULE,
    ORACLE,
    6,
    1_000n * 1_000_000n,
    10n * 1_000_000n,
    10n * 1_000_000n,
    10n * 1_000_000n,
  ]);
  const gas = somniaCreateGas(art.deployedBytecode.object);
  const createRcpt = await sendHttp(account, data, { gas });
  if (createRcpt.status !== "success" || !createRcpt.contractAddress) {
    throw new Error(`scratch vault deploy failed hash=${createRcpt.transactionHash}`);
  }
  const { encodeFunctionData } = await import("viem");
  const killRcpt = await sendHttp(
    account,
    encodeFunctionData({ abi: vaultAbi, functionName: "kill" }),
    { to: createRcpt.contractAddress, gas: 5_000_000n },
  );
  if (killRcpt.status !== "success") {
    throw new Error(`kill failed hash=${killRcpt.transactionHash}`);
  }
  const client = shannonHttpClient();
  const killed = await client.readContract({
    address: createRcpt.contractAddress,
    abi: vaultAbi,
    functionName: "killed",
  });
  const operator = await client.readContract({
    address: createRcpt.contractAddress,
    abi: vaultAbi,
    functionName: "operator",
  });
  let depositBlocked = false;
  const dep = await sendHttp(
    account,
    encodeFunctionData({ abi: vaultAbi, functionName: "deposit", args: [1n] }),
    { to: createRcpt.contractAddress, gas: 5_000_000n },
  );
  depositBlocked = dep.status !== "success";
  return {
    scratch: createRcpt.contractAddress,
    createTx: createRcpt.transactionHash,
    killTx: killRcpt.transactionHash,
    killed,
    operatorCleared: operator === "0x0000000000000000000000000000000000000000",
    depositBlocked,
    depositTx: dep.transactionHash,
  };
}

export async function refillVaultShield(account: LocalAccount, vault: Address): Promise<boolean> {
  const { encodeFunctionData } = await import("viem");
  try {
    const rcpt = await sendHttp(
      account,
      encodeFunctionData({ abi: vaultAbi, functionName: "refillShield" }),
      { to: vault, gas: 5_000_000n },
    );
    return rcpt.status === "success";
  } catch {
    return false;
  }
}

const managerWriteAbi = parseAbi([
  "function register(address vault, bytes32 marketId) returns (uint256)",
  "function subscriptionOf(bytes32) view returns (uint256)",
]);

const armedAbi = parseAbi([
  "function armed() view returns (bytes32 marketId, address pool, address market, uint64 nonce, uint8 kind, uint256 price, uint256 quantity, uint64 expireNs, uint8 orderType, bool active, uint128 lastOrderId)",
]);

export async function readReactivityGate(
  vault: Address,
  marketId: Hex,
): Promise<{ subscribed: boolean; subscriptionId: string; armedActive: boolean; armedMarketId: Hex }> {
  const dep = loadShannonDeployment();
  const client = shannonHttpClient();
  const { keccak256, encodePacked } = await import("viem");
  const k = keccak256(encodePacked(["address", "bytes32"], [vault, marketId]));
  const [subId, armedRaw] = await Promise.all([
    client.readContract({
      address: dep.manager,
      abi: managerWriteAbi,
      functionName: "subscriptionOf",
      args: [k],
    }),
    client.readContract({ address: vault, abi: armedAbi, functionName: "armed" }),
  ]);
  const armed = armedRaw as {
    active?: boolean;
    marketId?: Hex;
  } & readonly unknown[];
  const armedActive = Boolean(armed.active ?? armed[9]);
  const armedMarketId = (armed.marketId ?? armed[0]) as Hex;
  return {
    subscribed: subId !== 0n,
    subscriptionId: subId.toString(),
    armedActive,
    armedMarketId,
  };
}

/** Subscribe the vault to OracleHub AnswerDelivered for this market. Shared-stake manager pays; no-ops if already registered or unfunded. */
export async function registerMarketSubscription(
  account: LocalAccount,
  vault: Address,
  marketId: Hex,
): Promise<{ tx: Hex | null; subscriptionId: string | null; skipped: string | null }> {
  const dep = loadShannonDeployment();
  const client = shannonHttpClient();
  const { keccak256, encodePacked, encodeFunctionData } = await import("viem");
  const k = keccak256(encodePacked(["address", "bytes32"], [vault, marketId]));
  const existing = await client.readContract({
    address: dep.manager,
    abi: managerWriteAbi,
    functionName: "subscriptionOf",
    args: [k],
  });
  if (existing !== 0n) {
    return { tx: null, subscriptionId: existing.toString(), skipped: "already_registered" };
  }
  const bal = await client.getBalance({ address: dep.manager });
  if (bal < 32n * 10n ** 18n) {
    return { tx: null, subscriptionId: null, skipped: "manager_stake_low" };
  }
  try {
    const rcpt = await sendHttp(
      account,
      encodeFunctionData({
        abi: managerWriteAbi,
        functionName: "register",
        args: [vault, marketId],
      }),
      { to: dep.manager, gas: 10_000_000n },
    );
    if (rcpt.status !== "success") {
      return { tx: rcpt.transactionHash, subscriptionId: null, skipped: "register_reverted" };
    }
    const id = await client.readContract({
      address: dep.manager,
      abi: managerWriteAbi,
      functionName: "subscriptionOf",
      args: [k],
    });
    return { tx: rcpt.transactionHash, subscriptionId: id.toString(), skipped: null };
  } catch (e) {
    return { tx: null, subscriptionId: null, skipped: (e as Error).message.slice(0, 180) };
  }
}

export function writeEvidence(name: string, data: unknown): void {
  mkdirSync(resolve(process.cwd(), "docs/evidence"), { recursive: true });
  writeFileSync(resolve(process.cwd(), "docs/evidence", name), JSON.stringify(data, null, 2));
}

export async function runVaultFunding(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  const dep = loadShannonDeployment();
  const before = await readVaultSnapshot(dep.vault);
  const deposit = await fundVault(account, dep.vault, 10_000_000n);
  const withdraw = await withdrawVault(account, dep.vault, 2_000_000n);
  const after = await readVaultSnapshot(dep.vault);
  const scratch = await deployScratchAndKill(account);
  const evidence = {
    chainId: 50312,
    vault: dep.vault,
    snapshotBefore: before,
    deposit,
    withdraw,
    snapshotAfter: after,
    scratch,
  };
  writeEvidence("shannon-funding.json", evidence);
  return evidence;
}
