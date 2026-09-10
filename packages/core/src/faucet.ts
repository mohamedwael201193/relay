import { erc20Abi, formatEther, formatUnits, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { DEFAULT_SHANNON_RPC, EXPECTED_SHANNON_DECIMALS, SHANNON_ADDRESSES } from "./addresses.js";
import { createExchange } from "./exchange.js";
import { envString } from "./env.js";
import { shannonClient } from "./rpc.js";

export async function runShannonFaucet(privateKey: Hex): Promise<{
  address: Address;
  hash: Hex;
  status: "success" | "reverted";
  before: { stt: string; tusdc: string };
  after: { stt: string; tusdc: string };
}> {
  const account = privateKeyToAccount(privateKey);
  const rpc = envString("SOMNIA_SHANNON_RPC_URL", DEFAULT_SHANNON_RPC)!;
  const client = shannonClient(rpc);
  const collateral = SHANNON_ADDRESSES.collateral as Address;
  const beforeNative = await client.getBalance({ address: account.address });
  const beforeTusdc = await client.readContract({
    address: collateral,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  const exchange = createExchange("shannon", privateKey);
  const result = await exchange.trader.faucet();
  const afterNative = await client.getBalance({ address: account.address });
  const afterTusdc = await client.readContract({
    address: collateral,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  return {
    address: account.address,
    hash: result.hash,
    status: result.receipt.status,
    before: {
      stt: formatEther(beforeNative),
      tusdc: formatUnits(beforeTusdc, EXPECTED_SHANNON_DECIMALS),
    },
    after: {
      stt: formatEther(afterNative),
      tusdc: formatUnits(afterTusdc, EXPECTED_SHANNON_DECIMALS),
    },
  };
}
