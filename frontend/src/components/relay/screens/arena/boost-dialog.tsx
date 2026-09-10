"use client";

/**
 * RELAY — boost dialog.
 * Boosting deploys a mirrored runner: the target's exact config, your
 * budget. Amount tiles in tUSDC, an honest insufficient-balance error,
 * and an in-dialog success state once the mirror is deployed.
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
  const [done, setDone] = useState(false);

  const insufficient = wallet.tUSDC < amount;

  // reset the chooser whenever the dialog closes (X, ESC, overlay, or CTA)
  const handleOpenChange = (o: boolean) => {
    if (!o) setDone(false);
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-2xl border-2 border-lined bg-panel text-cream">
        {done ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <FlameMark animated className="h-12 w-12" />
            <div className="text-xl font-black wide leading-tight">
              MIRRORED RUNNER DEPLOYED
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-foam">
              {money(amount)} now mirrors {entry.name}&rsquo;s config. You earn
              their exact lap results — wins, losses, streaks and all. Winnings
              settle to your wallet automatically.
            </p>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="mt-1 rounded-xl border-2 border-limedeep bg-lime px-5 py-2.5 font-black wide text-sm text-graphite transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
            >
              BACK TO THE ARENA
            </button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-black wide text-xl">
                Boost {entry.name}
              </DialogTitle>
              <DialogDescription className="text-foam">
                Your boost deploys a mirrored runner — same config, your budget.
                You earn their exact lap results.
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

            <button
              type="button"
              disabled={insufficient}
              onClick={() => {
                boostRunner(entry.runnerId, amount);
                setDone(true);
              }}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-lime bg-lime px-4 py-3.5",
                "font-black wide text-base text-graphite hardshadow-d transition-transform",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
                insufficient
                  ? "cursor-not-allowed opacity-50"
                  : "hover:-translate-y-0.5 active:translate-y-0"
              )}
            >
              <FlameMark className="h-5 w-5" aria-hidden />
              BOOST {money(amount)}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
