"use client";

import { useActiveWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { publicEnv } from "@/lib/relay/config/network";
import { shortAddr } from "@/lib/relay/format";
import { CtlButton } from "../screens/settings/ui";

export function WalletAuthControls({ compact = false }: { compact?: boolean }) {
  if (!publicEnv().privyAppId) {
    return (
      <span className="mlabel min-h-[36px] rounded-lg border-2 border-lined bg-panel2 px-2.5 text-foam">
        WALLET UNAVAILABLE
      </span>
    );
  }
  return <WalletAuthInner compact={compact} />;
}

function WalletAuthInner({ compact }: { compact: boolean }) {
  const { ready, authenticated, login, logout, createWallet } = usePrivy();
  const { wallets } = useWallets();
  const { wallet: active, setActiveWallet } = useActiveWallet();

  if (!ready) {
    return (
      <span className="mlabel min-h-[36px] rounded-lg border-2 border-lined bg-panel2 px-2.5 text-foam">
        WALLET
      </span>
    );
  }
  if (!authenticated) {
    return (
      <CtlButton tone="lime" className={compact ? "min-h-9 px-3 py-1.5" : undefined} onClick={() => login()}>
        CONNECT
      </CtlButton>
    );
  }

  const hasEmbedded = wallets.some((w) => w.walletClientType === "privy");

  return (
    <>
      {wallets.length > 1 && !compact
        ? wallets.map((w) => (
            <CtlButton
              key={w.address}
              tone={active?.address?.toLowerCase() === w.address.toLowerCase() ? "lime" : "outline"}
              onClick={() => setActiveWallet(w)}
            >
              {shortAddr(w.address)}
            </CtlButton>
          ))
        : null}
      {!hasEmbedded && !compact ? (
        <CtlButton
          tone="outline"
          onClick={() => {
            void createWallet().catch(() => undefined);
          }}
        >
          ADD WALLET
        </CtlButton>
      ) : null}
      <CtlButton tone="outline" className={compact ? "min-h-9 px-3 py-1.5" : undefined} onClick={() => logout()}>
        DISCONNECT
      </CtlButton>
    </>
  );
}
