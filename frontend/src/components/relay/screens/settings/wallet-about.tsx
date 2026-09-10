"use client";

/**
 * RELAY — settings · SAFETY / WALLET / DEMO sections.
 * The guarantees, the keys, and the (hidden) developer console door.
 */

import { Copy, Lock, Power, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useRelay } from "@/lib/relay/engine/store";
import { money, shortAddr } from "@/lib/relay/format";
import { isLiveMode } from "@/lib/relay/live/mode";
import { Panel } from "../../core/primitives";
import { LiveDot } from "../../core/primitives";
import { AssetIcon, RelayLogo } from "../../identity/identity";
import { CtlButton } from "./ui";
import { WalletAuthControls } from "../../wallet/WalletAuthControls";

/* ── safety guarantees ──────────────────────────────────────── */

const SAFETY_ROWS: { Icon: LucideIcon; label: string; text: string }[] = [
  {
    Icon: Lock,
    label: "WALLET",
    text: "The runner can trade. It can never withdraw.",
  },
  {
    Icon: Scale,
    label: "RISK",
    text: "Bounded by construction — worst case is your stop-loss, on-chain.",
  },
  {
    Icon: Power,
    label: "CONTROL",
    text: "Kill it any time. Orders self-expire, funds stay yours.",
  },
];

export function SafetySection() {
  return (
    <Panel label="SAFETY">
      <div className="px-5 pb-5 pt-3">
        <div className="grid gap-4">
          {SAFETY_ROWS.map(({ Icon, label, text }) => (
            <div key={label} className="flex items-start gap-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-lined bg-panel2">
                <Icon className="size-5 text-cream" aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="mlabel text-lime">{label}</div>
                <div className="mt-1 text-sm leading-relaxed text-cream/90">{text}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="mlabel mt-5 border-t-2 border-lined pt-4 text-foam/60">
          TESTNET DEMO · NOT FINANCIAL ADVICE
        </p>
      </div>
    </Panel>
  );
}

/* ── wallet & network ───────────────────────────────────────── */

export function WalletSection() {
  const wallet = useRelay((s) => s.wallet);
  const apiError = useRelay((s) => s.apiError);
  const { toast } = useToast();

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(wallet.address);
      toast({
        title: "Address copied",
        description: "Full wallet address is on your clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard is unavailable in this context.",
        variant: "destructive",
      });
    }
  };

  return (
    <Panel label="WALLET">
      <div className="px-5 pb-5 pt-3">
        {/* address + connect state */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
          <span className="data text-base font-semibold text-cream">
            {wallet.connected && wallet.address ? shortAddr(wallet.address) : "NOT CONNECTED"}
          </span>
          <button
            type="button"
            onClick={copyAddress}
            aria-label="Copy full wallet address"
            disabled={!wallet.address}
            className="grid size-11 place-items-center rounded-lg border-2 border-lined text-foam transition-colors hover:border-foam/60 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-40"
          >
            <Copy className="size-4" aria-hidden />
          </button>
          <WalletAuthControls />
        </div>

        {/* network */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <LiveDot label="SOMNIA · SHANNON TESTNET" />
        </div>

        {/* balances */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-t-2 border-lined pt-4">
          <span className="flex items-center gap-2.5">
            <AssetIcon asset="tUSDC" size={26} />
            <span className="data text-2xl font-semibold text-cream">
              {money(wallet.tUSDC)}
            </span>
            <span className="mlabel text-foam/70">SPENDABLE</span>
          </span>
          <span className="data text-xs text-foam">
            STT {wallet.nativeSTT.toLocaleString("en-US")} · GAS
          </span>
        </div>
        {apiError ? (
          <p className="mlabel mt-3 text-ember">{apiError}</p>
        ) : null}

        {/* faucet */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-lined pt-4">
          <div className="min-w-0">
            <div className="mlabel text-foam">TESTNET FAUCET</div>
            <div className="mt-1 text-xs text-foam/70">
              Shannon tUSDC faucet via DreamDEX trader.faucet
            </div>
          </div>
          <CtlButton
            tone="outline"
            className="data text-xs"
            onClick={() =>
              window.open("https://testnet.somnia.network", "_blank", "noopener,noreferrer")
            }
          >
            OPEN FAUCET
          </CtlButton>
        </div>
      </div>
    </Panel>
  );
}

/* ── demo & about ───────────────────────────────────────────── */

export function DemoSection() {
  const demoTogglePanel = useRelay((s) => s.demoTogglePanel);
  if (isLiveMode()) {
    return (
      <Panel label="ABOUT">
        <div className="px-5 pb-5 pt-3">
          <div className="mt-4 flex items-center gap-3">
            <RelayLogo tone="cream" compact />
            <span className="data text-xs text-foam">
              RELAY · BUILT ON SOMNIA · DREAMDEX EVENT CONTRACTS
            </span>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel label="DEMO">
      <div className="px-5 pb-5 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-cream">Developer demo controls</div>
            <div className="mt-0.5 text-xs text-foam">
              speed, forced outcomes, engine freeze, reset
            </div>
          </div>
          <CtlButton tone="limeOutline" onClick={() => demoTogglePanel(true)}>
            OPEN
          </CtlButton>
        </div>
        <div className="data mt-1.5 text-[10px] text-foam/50">
          HASH #/DEMO OR PRESS “D” THREE TIMES ANYWHERE
        </div>

        <div className="mt-4 flex items-center gap-3 border-t-2 border-lined pt-4">
          <RelayLogo tone="cream" compact />
          <span className="data text-xs text-foam">
            RELAY · BUILT ON SOMNIA · DREAMDEX EVENT CONTRACTS
          </span>
        </div>
      </div>
    </Panel>
  );
}
