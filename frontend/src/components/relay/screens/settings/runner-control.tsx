"use client";

/**
 * RELAY — settings · RUNNER CONTROL.
 * The kill switch row: status, pause/resume, kill, withdraw, redeploy.
 * Every destructive act gets an AlertDialog; every reassuring fact is
 * on the record: funds stay withdrawable no matter what.
 */

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useRelay } from "@/lib/relay/engine/store";
import type { RunnerStatus } from "@/lib/relay/types";
import { duration, money } from "@/lib/relay/format";
import { cn } from "@/lib/utils";
import { Panel } from "../../core/primitives";
import { CtlButton, StatusChip } from "./ui";

function hintFor(status: RunnerStatus, bankroll: number): { text: string; tone?: string } {
  switch (status) {
    case "RUNNING":
      return { text: "Trades every window inside the bounds you set — and nothing else." };
    case "DEPLOYING":
      return { text: "Arming the vault, locking the budget, first window incoming." };
    case "PAUSED":
      return { text: "No new laps start. The open position settles normally, then it waits." };
    case "PARKED":
      return { text: "Parked at the stop-loss — the runner stood down on its own." };
    case "STOPPED":
      return bankroll > 0
        ? { text: "Runner killed. Funds stay withdrawable.", tone: "text-ember/90" }
        : { text: "Runner stopped — bankroll withdrawn to your wallet." };
  }
}

export function RunnerControlSection() {
  const runner = useRelay((s) => s.runner);
  const bankroll = useRelay((s) => s.bankroll);
  const minute = useRelay((s) => Math.floor(s.now / 60_000));
  const pauseRunner = useRelay((s) => s.pauseRunner);
  const resumeRunner = useRelay((s) => s.resumeRunner);
  const stopRunner = useRelay((s) => s.stopRunner);
  const withdraw = useRelay((s) => s.withdraw);
  const goScreen = useRelay((s) => s.goScreen);

  const [killOpen, setKillOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    <Panel label="RUNNER CONTROL">
      <div className="px-5 pb-5 pt-3">
        {!runner ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="mlabel text-foam">NO RUNNER DEPLOYED</span>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-foam">
                The track is empty. Deploy a runner — it trades inside the bounds you
                set here, and nothing else.
              </p>
            </div>
            <CtlButton tone="lime" onClick={() => goScreen("deploy")}>
              DEPLOY A RUNNER
            </CtlButton>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
              <StatusChip status={runner.status} />
              <span className="text-lg font-black wide tracking-[0.01em] text-cream">
                {runner.name}
              </span>
              <span className="data text-xs text-foam">
                deployed {duration(runner.deployedAt, minute * 60_000)} ago
              </span>
            </div>
            <p className={cn("mt-2 text-xs leading-relaxed", hintFor(runner.status, bankroll).tone ?? "text-foam")}>
              {hintFor(runner.status, bankroll).text}
            </p>

            <div className="mt-4 flex flex-wrap gap-2.5">
              {runner.status === "RUNNING" && (
                <CtlButton tone="flame" onClick={pauseRunner}>
                  PAUSE RUNNER
                </CtlButton>
              )}
              {runner.status === "PAUSED" && (
                <CtlButton tone="lime" onClick={resumeRunner}>
                  RESUME RUNNER
                </CtlButton>
              )}

              <CtlButton
                tone="ember"
                disabled={runner.status === "STOPPED"}
                onClick={() => setKillOpen(true)}
              >
                KILL RUNNER
              </CtlButton>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex rounded-xl">
                    <CtlButton
                      tone="limeOutline"
                      disabled={bankroll <= 0}
                      onClick={() => setWithdrawOpen(true)}
                    >
                      WITHDRAW {money(bankroll)}
                    </CtlButton>
                  </span>
                </TooltipTrigger>
                {bankroll <= 0 && (
                  <TooltipContent side="top" className="data">
                    Nothing to withdraw.
                  </TooltipContent>
                )}
              </Tooltip>

              <CtlButton tone="outline" onClick={() => goScreen("deploy")}>
                REDEPLOY
              </CtlButton>
            </div>
          </>
        )}
      </div>

      {/* kill confirm */}
      {runner && (
        <AlertDialog open={killOpen} onOpenChange={setKillOpen}>
          <AlertDialogContent className="rounded-2xl border-2 border-lined bg-panel">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-black wide text-xl text-cream">
                KILL {runner.name.toUpperCase()}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-foam">
                Orders self-expire, the operator is revoked, your bankroll stays
                withdrawable.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="mlabel rounded-xl border-2 border-lined bg-transparent text-cream hover:bg-panel2 hover:text-cream">
                KEEP IT RUNNING
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => stopRunner()}
                className="mlabel rounded-xl border-2 border-ember bg-ember text-cream hover:bg-ember/90"
              >
                KILL RUNNER
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* withdraw confirm */}
      {runner && bankroll > 0 && (
        <AlertDialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <AlertDialogContent className="rounded-2xl border-2 border-lined bg-panel">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-black wide text-xl text-cream">
                WITHDRAW {money(bankroll)} TO YOUR WALLET?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-foam">
                tUSDC returns to your wallet and the runner stops — redeploy any time.
                Withdrawals are yours alone: no runner can ever move funds.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="mlabel rounded-xl border-2 border-lined bg-transparent text-cream hover:bg-panel2 hover:text-cream">
                NOT NOW
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => withdraw()}
                className="mlabel rounded-xl border-2 border-lime bg-lime text-graphite hover:bg-lime/90"
              >
                WITHDRAW {money(bankroll)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Panel>
  );
}
