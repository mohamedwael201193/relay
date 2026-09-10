import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SHANNON_ADDRESSES } from "./addresses.js";
import { codeSize } from "./rpc.js";
import { encodeCreate } from "./sendRealtime.js";
import {
  assertDeployBudget,
  sendHttp,
  shannonHttpClient,
  somniaCreateGas,
} from "./sendHttp.js";

type Artifact = { abi: never; bytecode: { object: Hex }; deployedBytecode: { object: Hex } };

function loadArtifact(name: string): Artifact {
  const p = resolve(process.cwd(), "contracts/out", `${name}.sol`, `${name}.json`);
  return JSON.parse(readFileSync(p, "utf8")) as Artifact;
}

function bytecodeBytes(hex: Hex): number {
  return Math.max(0, (hex.length - 2) / 2);
}

export async function deployShannon(privateKey: Hex): Promise<{
  vault: Address;
  registry: Address;
  manager: Address;
  txs: Hex[];
}> {
  const account = privateKeyToAccount(privateKey);
  const txs: Hex[] = [];
  const client = shannonHttpClient();

  const vaultArt = loadArtifact("RunnerVault");
  const vaultGas = somniaCreateGas(vaultArt.deployedBytecode.object);
  console.log(
    JSON.stringify({
      phase: "deploy-gas",
      vaultCreationBytes: bytecodeBytes(vaultArt.bytecode.object),
      vaultDeployedBytes: bytecodeBytes(vaultArt.deployedBytecode.object),
      vaultGas: vaultGas.toString(),
      codeGasPerByte: 3125,
      path: "eth_sendRawTransaction",
    }),
  );
  await assertDeployBudget(account, vaultGas);

  const vaultData = encodeCreate(vaultArt.abi, vaultArt.bytecode.object, [
    account.address,
    SHANNON_ADDRESSES.collateral,
    SHANNON_ADDRESSES.binaryModule,
    SHANNON_ADDRESSES.oracleHub,
    6,
    10_000n * 1_000_000n,
    100n * 1_000_000n,
    500n * 1_000_000n,
    500n * 1_000_000n,
  ]);
  const vaultRcpt = await sendHttp(account, vaultData, { gas: vaultGas });
  txs.push(vaultRcpt.transactionHash);
  console.log(
    JSON.stringify({
      contract: "RunnerVault",
      hash: vaultRcpt.transactionHash,
      status: vaultRcpt.status,
      gasUsed: vaultRcpt.gasUsed.toString(),
      gasLimit: vaultGas.toString(),
      address: vaultRcpt.contractAddress,
      block: vaultRcpt.blockNumber.toString(),
    }),
  );
  if (vaultRcpt.status !== "success" || !vaultRcpt.contractAddress) {
    throw new Error(`RunnerVault deploy failed hash=${vaultRcpt.transactionHash} status=${vaultRcpt.status}`);
  }
  const vaultCode = await codeSize(client, vaultRcpt.contractAddress);
  if (vaultCode === 0) {
    throw new Error(`RunnerVault address has empty code hash=${vaultRcpt.transactionHash}`);
  }

  const regArt = loadArtifact("RelayRegistry");
  const regGas = somniaCreateGas(regArt.deployedBytecode.object);
  const regRcpt = await sendHttp(account, encodeCreate(regArt.abi, regArt.bytecode.object, []), { gas: regGas });
  txs.push(regRcpt.transactionHash);
  console.log(
    JSON.stringify({
      contract: "RelayRegistry",
      hash: regRcpt.transactionHash,
      status: regRcpt.status,
      gasUsed: regRcpt.gasUsed.toString(),
      address: regRcpt.contractAddress,
      block: regRcpt.blockNumber.toString(),
    }),
  );
  if (regRcpt.status !== "success" || !regRcpt.contractAddress) {
    throw new Error(`RelayRegistry deploy failed hash=${regRcpt.transactionHash} status=${regRcpt.status}`);
  }

  const mgrArt = loadArtifact("ReactivityManager");
  const mgrGas = somniaCreateGas(mgrArt.deployedBytecode.object);
  const mgrRcpt = await sendHttp(
    account,
    encodeCreate(mgrArt.abi, mgrArt.bytecode.object, [account.address, SHANNON_ADDRESSES.oracleHub]),
    { gas: mgrGas },
  );
  txs.push(mgrRcpt.transactionHash);
  console.log(
    JSON.stringify({
      contract: "ReactivityManager",
      hash: mgrRcpt.transactionHash,
      status: mgrRcpt.status,
      gasUsed: mgrRcpt.gasUsed.toString(),
      address: mgrRcpt.contractAddress,
      block: mgrRcpt.blockNumber.toString(),
    }),
  );
  if (mgrRcpt.status !== "success" || !mgrRcpt.contractAddress) {
    throw new Error(`ReactivityManager deploy failed hash=${mgrRcpt.transactionHash} status=${mgrRcpt.status}`);
  }

  const { encodeFunctionData } = await import("viem");
  const setOpRcpt = await sendHttp(
    account,
    encodeFunctionData({
      abi: parseAbi(["function setOperatorNow(address next)"]),
      functionName: "setOperatorNow",
      args: [account.address],
    }),
    { to: vaultRcpt.contractAddress, gas: 5_000_000n },
  );
  txs.push(setOpRcpt.transactionHash);
  if (setOpRcpt.status !== "success") {
    throw new Error(`setOperatorNow failed hash=${setOpRcpt.transactionHash}`);
  }

  const out = {
    chainId: 50312,
    vault: vaultRcpt.contractAddress,
    registry: regRcpt.contractAddress,
    manager: mgrRcpt.contractAddress,
    deployer: account.address,
    txs,
    vaultCodeBytes: vaultCode,
    vaultGasUsed: vaultRcpt.gasUsed.toString(),
    registryGasUsed: regRcpt.gasUsed.toString(),
    managerGasUsed: mgrRcpt.gasUsed.toString(),
    setOperatorTx: setOpRcpt.transactionHash,
    collateral: SHANNON_ADDRESSES.collateral,
    module: SHANNON_ADDRESSES.binaryModule,
    oracleHub: SHANNON_ADDRESSES.oracleHub,
    priceDecimals: 6,
    sendPath: "eth_sendRawTransaction",
    evmVersion: "cancun",
    codeGasPerByte: 3125,
  };
  mkdirSync(resolve(process.cwd(), "docs/evidence"), { recursive: true });
  writeFileSync(resolve(process.cwd(), "docs/evidence/shannon-deployment.json"), JSON.stringify(out, null, 2));
  mkdirSync(resolve(process.cwd(), "packages/core/src/deployments"), { recursive: true });
  writeFileSync(resolve(process.cwd(), "packages/core/src/deployments/shannon.json"), JSON.stringify(out, null, 2));
  return {
    vault: vaultRcpt.contractAddress,
    registry: regRcpt.contractAddress,
    manager: mgrRcpt.contractAddress,
    txs,
  };
}
