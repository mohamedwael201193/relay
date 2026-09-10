"use client";

import { useRelay } from "@/lib/relay/engine/store";
import { money, shortAddr } from "@/lib/relay/format";
import { AssetIcon } from "../identity/identity";
import { WalletAuthControls } from "./WalletAuthControls";

/** Connect / disconnect + spendable tUSDC for the app chrome. */
export function NavWallet() {
  const wallet = useRelay((s) => s.wallet);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <AssetIcon asset="tUSDC" size={18} />
        <span className="data text-sm text-cream">{money(wallet.tUSDC)}</span>
      </div>
      {wallet.connected && wallet.address ? (
        <span className="mlabel hidden truncate text-foam xl:inline">{shortAddr(wallet.address)}</span>
      ) : null}
      <WalletAuthControls compact />
    </div>
  );
}
