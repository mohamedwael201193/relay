import {
  createPublicClient,
  http,
  erc20Abi,
  type Address,
  type Chain,
  type PublicClient,
} from "viem";
import { somniaMainnet, somniaShannon } from "@somnia-chain/markets-sdk/chains";

export function publicClient(rpcUrl: string, chain: Chain): PublicClient {
  return createPublicClient({
    chain,
    transport: http(rpcUrl, { timeout: 20_000 }),
  });
}

export function shannonClient(rpcUrl: string): PublicClient {
  return publicClient(rpcUrl, somniaShannon);
}

export function mainnetClient(rpcUrl: string): PublicClient {
  return publicClient(rpcUrl, somniaMainnet);
}

export async function erc20Decimals(client: PublicClient, token: Address): Promise<number> {
  return client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "decimals",
  });
}

export async function erc20Balance(
  client: PublicClient,
  token: Address,
  owner: Address,
): Promise<bigint> {
  return client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
}

export async function codeSize(client: PublicClient, address: Address): Promise<number> {
  const code = await client.getCode({ address });
  if (!code || code === "0x") return 0;
  return (code.length - 2) / 2;
}

const EIP1967_IMPL =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;

export async function eip1967Implementation(
  client: PublicClient,
  proxy: Address,
): Promise<Address | null> {
  const slot = await client.getStorageAt({ address: proxy, slot: EIP1967_IMPL });
  if (!slot || slot === "0x" || /^0x0+$/.test(slot)) return null;
  return `0x${slot.slice(-40)}` as Address;
}
