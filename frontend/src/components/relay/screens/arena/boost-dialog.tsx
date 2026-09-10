"use client";

/**
 * RELAY — boost dialog.
 * Boost deploys an independent RunnerVault owned by you, cloning the
 * leader's bias / cadence / assets. Your tUSDC, RELAY operator — never
 * the leader's wallet.
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
  const boostRunner = useRelay((s) => s.boostRunner);
  const [amount, setAmount] = useState(25);

  const insufficient = wallet.tUSDC < amount;
  const self = !!entry.isYou;

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
            Deploys your own vault with this runner&apos;s {entry.bias} bias
            {entry.cadence ? ` · ${entry.cadence}` : ""}. You fund it. RELAY
            operates it. Not their wallet.
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
            Insufficient tUSDC
          </p>
        )}

        {self && (
          <p className="text-xs leading-relaxed text-foam">
            You already own this runner.
          </p>
        )}

        <button
          type="button"
          disabled={insufficient || self}
          onClick={() => {
            boostRunner(entry.runnerId, amount);
            onOpenChange(false);
          }}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-lime bg-lime px-4 py-3.5",
            "font-black wide text-base text-graphite hardshadow-d",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
            insufficient || self ? "cursor-not-allowed opacity-50" : "hover:-translate-y-0.5"
          )}
        >
          <FlameMark className="h-5 w-5" aria-hidden />
          BOOST {money(amount)}
        </button>
      </DialogContent>
    </Dialog>
  );
}
