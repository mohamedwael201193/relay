"use client";

import { usePrivy } from "@privy-io/react-auth";
import { publicEnv } from "@/lib/relay/config/network";
import { CtlButton } from "../screens/settings/ui";

export function WalletAuthControls() {
  if (!publicEnv().privyAppId) {
    return (
      <span className="mlabel min-h-[36px] rounded-lg border-2 border-lined bg-panel2 px-2.5 text-foam">
        WALLET UNAVAILABLE
      </span>
    );
  }
  return <WalletAuthInner />;
}

function WalletAuthInner() {
  const { ready, authenticated, login, logout } = usePrivy();
  if (!ready) {
    return (
      <span className="mlabel min-h-[36px] rounded-lg border-2 border-lined bg-panel2 px-2.5 text-foam">
        WALLET
      </span>
    );
  }
  if (!authenticated) {
    return (
      <CtlButton tone="lime" onClick={() => login()}>
        CONNECT
      </CtlButton>
    );
  }
  return (
    <CtlButton tone="outline" onClick={() => logout()}>
      DISCONNECT
    </CtlButton>
  );
}
