import { recoverMessageAddress, type Address, type Hex } from "viem";
import { SHANNON_CHAIN_ID } from "@relay/core";

export type OwnerAction = "start" | "stop" | "register" | "provision" | "pause" | "resume";

export function ownerMessage(action: OwnerAction, vault: string, timestamp: number): string {
  return `RELAY ${action} vault ${vault.toLowerCase()} chain ${SHANNON_CHAIN_ID} at ${timestamp}`;
}

export function timestampFresh(timestamp: number, now = Date.now(), windowMs = 10 * 60_000): boolean {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  return Math.abs(now - timestamp) <= windowMs;
}

export async function recoverOwner(message: string, signature: string): Promise<Address> {
  if (!/^0x[0-9a-fA-F]+$/.test(signature)) {
    throw new Error("bad_signature");
  }
  return recoverMessageAddress({ message, signature: signature as Hex });
}

export function sameAddr(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
