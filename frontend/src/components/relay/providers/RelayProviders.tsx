"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { publicEnv } from "@/lib/relay/config/network";
import { somniaShannon } from "@/lib/relay/live/chain";
import { LiveBridge } from "@/lib/relay/live/LiveBridge";

export function RelayProviders({ children }: { children: React.ReactNode }) {
  const appId = publicEnv().privyAppId;
  if (!appId) {
    return <>{children}</>;
  }
  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#c6ff4a",
          logo: undefined,
        },
        defaultChain: somniaShannon,
        supportedChains: [somniaShannon],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <LiveBridge />
      {children}
    </PrivyProvider>
  );
}
