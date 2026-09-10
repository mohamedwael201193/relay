"use client";

/**
 * RELAY — boost dialog.
 * Boost is not implemented on-chain (no BoostController). The chrome
 * stays; the CTA is honest: independent vaults only, not a live mirror.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useRelay } from "@/lib/relay/engine/store";
import { money } from "@/lib/relay/format";
import type { ArenaRunner } from "@/lib/relay/types";
import { cn } from "@/lib/utils";
import { AssetIcon, FlameMark } from "../../identity/identity";

const AMOUNTS = [10, 25, 50];

export function BoostDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: ArenaRunner;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const wallet = useRelay((s) => s.wallet);
  const [amount, setAmount] = useState(25);

  const insufficient = wallet.tUSDC < amount;

  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-2xl border-2 border-lined bg-panel text-cream">
        <DialogHeader>
          <DialogTitle className="font-black wide text-xl">
            Boost {entry.name}
          </DialogTitle>
          <DialogDescription className="text-foam">
            Boost would deploy an independent vault for you — not a live
            mirror of this runner. There is no BoostController on-chain.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3" role="group" aria-label="Boost amount">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(a)}
              aria-pressed={amount === a}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
                amount === a
                  ? "border-lime bg-lime/10"
                  : "border-lined hover:border-foam/40"
              )}
            >
              <AssetIcon asset="tUSDC" size={26} />
              <span className="data text-sm font-semibold">{money(a)}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between data text-xs text-foam">
          <span>WALLET BALANCE</span>
          <span>{money(wallet.tUSDC)} tUSDC</span>
        </div>

        {insufficient && (
          <p className="text-xs font-semibold text-ember" role="alert">
            Insufficient tUSDC — visit Settings → faucet (demo)
          </p>
        )}

        <p className="text-xs leading-relaxed text-foam">
          BOOST IS NOT LIVE — independent vaults only. Use Deploy to start your own runner.
        </p>

        <button
          type="button"
          disabled
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-lime bg-lime px-4 py-3.5",
            "font-black wide text-base text-graphite hardshadow-d",
            "cursor-not-allowed opacity-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
          )}
        >
          <FlameMark className="h-5 w-5" aria-hidden />
          BOOST {money(amount)}
        </button>
      </DialogContent>
    </Dialog>
  );
}
