import { defineChain } from "viem";
import { SHANNON_CHAIN_ID } from "../config/network";

export const somniaShannon = defineChain({
  id: SHANNON_CHAIN_ID,
  name: "Somnia Shannon",
  nativeCurrency: { decimals: 18, name: "Somnia Test Token", symbol: "STT" },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network"] },
  },
  blockExplorers: {
    default: { name: "Shannon Explorer", url: "https://shannon-explorer.somnia.network" },
  },
  testnet: true,
});
