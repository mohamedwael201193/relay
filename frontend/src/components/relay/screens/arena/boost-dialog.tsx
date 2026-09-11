"use client";

/**
 * RELAY — boost dialog.
 * Boost deploys an independent RunnerVault owned by you, cloning the
 * leader's bias / cadence / assets. Your tUSDC, RELAY operator — never
 * the leader's wallet.
 *
 * Signature acceptance is not completion. BOOSTED only after the child
 * vault exists on-chain and the backend has verified it.
 */

import { useEffect, useState } from "react";
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

function boostLabel(status: string | undefined, label: string | undefined, failed: boolean, complete: boolean): string {
  if (complete) return "BOOST COMPLETE";
  if (failed) return "BOOST FAILED";
  if (status === "waiting" || status === "signing") return "SIGNATURE REQUIRED";
  if (status === "submitting" && /provision|creat/i.test(label ?? "")) return "PROVISIONING";
  if (status === "submitting") return "SIGNATURE ACCEPTED";
  if (status === "confirming") return "ON-CHAIN CONFIRMING";
  if (status === "confirmed") return "VERIFYING CHILD";
  if (label) return label.toUpperCase();
  return "BOOST PENDING";
}

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
  const txPhase = useRelay((s) => s.txPhase);
  const boostIntent = useRelay((s) => s.boostIntent);
  const [amount, setAmount] = useState(25);
  const [started, setStarted] = useState(false);

  const insufficient = wallet.tUSDC < amount;
  const self = !!entry.isYou;
  const childVault = boostIntent?.childVault;
  const boosting = started && !!boostIntent;
  const failed = boosting && txPhase?.status === "failed";
  const complete =
    boosting &&
    txPhase?.status === "confirmed" &&
    !!childVault &&
    childVault.toLowerCase() !== entry.runnerId.toLowerCase();
  const busy = boosting && !failed && !complete;
  const statusText = boostLabel(txPhase?.status, txPhase?.label, Boolean(failed), Boolean(complete));

  useEffect(() => {
    if (!open) setStarted(false);
  }, [open]);

  const handleOpenChange = (o: boolean) => {
    if (busy) return;
    if (!o) useRelay.setState({ boostIntent: null, txPhase: failed || complete ? null : useRelay.getState().txPhase });
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
              disabled={busy}
              onClick={() => setAmount(a)}
              aria-pressed={amount === a}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
                amount === a
                  ? "border-lime bg-lime/10"
                  : "border-lined hover:border-foam/40",
                busy && "opacity-60",
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

        {started ? (
          <div
            className={cn(
              "rounded-xl border-2 px-4 py-3 text-center",
              complete ? "border-lime bg-lime/10" : failed ? "border-ember bg-ember/10" : "border-lined",
            )}
            role="status"
            aria-live="polite"
          >
            <div className={cn("mlabel", complete ? "text-lime" : failed ? "text-ember" : "text-flame")}>
              {statusText}
            </div>
            {txPhase?.hash ? (
              <div className="data mt-1 truncate text-[0.65rem] text-foam">{txPhase.hash}</div>
            ) : null}
            {complete && childVault ? (
              <div className="data mt-1 truncate text-[0.65rem] text-foam">CHILD {childVault}</div>
            ) : null}
            {failed && txPhase?.label ? (
              <p className="mt-1 text-xs text-ember">{txPhase.label}</p>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          disabled={insufficient || self || busy}
          onClick={() => {
            if (complete) {
              onOpenChange(false);
              return;
            }
            setStarted(true);
            void boostRunner(entry.runnerId, amount);
          }}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-lime bg-lime px-4 py-3.5",
            "font-black wide text-base text-graphite hardshadow-d",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime",
            insufficient || self || busy ? "cursor-not-allowed opacity-50" : "hover:-translate-y-0.5",
          )}
        >
          <FlameMark className="h-5 w-5" aria-hidden />
          {complete ? "DONE" : busy ? statusText : `BOOST ${money(amount)}`}
        </button>
      </DialogContent>
    </Dialog>
  );
}
