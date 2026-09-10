"use client";

/**
 * RELAY — app shell (the BROADCAST world's chrome).
 *
 * Desktop (lg+): fixed left rail — logo, live mini lap-ring, section nav,
 * alerts, network + wallet — plus a broadcast status top bar. The main
 * column scrolls on its own; the rail never moves.
 * Mobile: compact top bar (logo · wallet · alerts) and a bottom tab deck
 * with an elevated center LIVE button and a "More" sheet.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Bell,
  Menu,
  Radio,
  Rocket,
  ScrollText,
  Settings2,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { selectUnread, useRelay } from "@/lib/relay/engine/store";
import { countdown, money } from "@/lib/relay/format";
import type { AppScreen } from "@/lib/relay/types";
import { cn } from "@/lib/utils";
import { FlameMark, RelayLogo } from "../identity/identity";
import { LapRing } from "../core/LapRing";
import { LiveDot } from "../core/primitives";
import { MyRunnerScreen } from "../screens/MyRunnerScreen";
import { DeployScreen } from "../screens/DeployScreen";
import { LiveLapScreen } from "../screens/LiveLapScreen";
import { ArenaScreen } from "../screens/ArenaScreen";
import { RunnerProfileScreen } from "../screens/RunnerProfileScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { AnalyticsScreen } from "../screens/AnalyticsScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { NavWallet } from "../wallet/NavWallet";

/* ── screen registry ('result' re-uses MY RUNNER) ─────────────── */

const SCREENS: Record<AppScreen, ComponentType> = {
  home: MyRunnerScreen,
  deploy: DeployScreen,
  live: LiveLapScreen,
  result: MyRunnerScreen,
  arena: ArenaScreen,
  runner: RunnerProfileScreen,
  history: HistoryScreen,
  analytics: AnalyticsScreen,
  notifications: NotificationsScreen,
  settings: SettingsScreen,
};

const KICKER: Record<AppScreen, string> = {
  home: "MY RUNNER",
  deploy: "DEPLOY",
  live: "LIVE LAP",
  result: "MY RUNNER",
  arena: "ARENA",
  runner: "RUNNER PROFILE",
  history: "TAPE",
  analytics: "ANALYTICS",
  notifications: "ALERTS",
  settings: "SETTINGS",
};

const NAV: { screen: AppScreen; label: string; Icon: LucideIcon }[] = [
  { screen: "home", label: "MY RUNNER", Icon: Activity },
  { screen: "deploy", label: "DEPLOY", Icon: Rocket },
  { screen: "live", label: "LIVE LAP", Icon: Radio },
  { screen: "arena", label: "ARENA", Icon: Trophy },
  { screen: "history", label: "TAPE", Icon: ScrollText },
  { screen: "analytics", label: "ANALYTICS", Icon: BarChart3 },
  { screen: "settings", label: "SETTINGS", Icon: Settings2 },
];

/** which rail section is lit for a given screen */
function navKeyFor(screen: AppScreen): AppScreen {
  if (screen === "result") return "home";
  if (screen === "runner") return "arena";
  return screen;
}

function Divider() {
  return <span className="h-5 w-px shrink-0 bg-lined" aria-hidden />;
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="grid h-4 min-w-4 place-items-center rounded-full bg-ember px-1 data text-[10px] font-semibold leading-none text-cream">
      {count > 9 ? "9+" : count}
    </span>
  );
}

/* ── left rail ───────────────────────────────────────────────── */

function RailLiveCard() {
  const liveLap = useRelay((s) => s.liveLap);
  const streak = useRelay((s) => s.streak.current);

  if (!liveLap) {
    return (
      <div className="rounded-xl border-2 border-lined bg-panel2/40 px-3 py-3.5 text-center">
        <div className="mlabel text-foam">RUNNER WAITING</div>
        <div className="data mt-1.5 text-sm text-cream/70">— : —</div>
      </div>
    );
  }
  const progress =
    liveLap.windowTotalMs > 0 ? liveLap.windowElapsedMs / liveLap.windowTotalMs : 0;
  return (
    <div className="rounded-xl border-2 border-lined bg-panel2/40 p-3">
      <div className="flex justify-center">
        <LapRing
          progress={progress}
          countdownLabel={countdown(liveLap.countdownMs)}
          phase={liveLap.phase}
          asset={liveLap.market.asset}
          side={liveLap.position?.side ?? null}
          size={76}
          compact
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="mlabel text-foam">LAP {liveLap.number}</span>
        <span className="flex items-center gap-1.5" aria-label={`Streak ×${streak}`}>
          <FlameMark className="h-3.5 w-auto" animated={streak > 0} />
          <span className="data text-xs text-cream">×{streak}</span>
        </span>
      </div>
    </div>
  );
}

function Rail() {
  const screen = useRelay((s) => s.screen);
  const go = useRelay((s) => s.go);
  const goScreen = useRelay((s) => s.goScreen);
  const unread = useRelay((s) => selectUnread(s.notifications));
  const navKey = navKeyFor(screen);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r-2 border-lined bg-graphite lg:flex">
      <div className="border-b-2 border-lined p-5">
        <button
          type="button"
          onClick={() => go("landing")}
          aria-label="RELAY — back to landing"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime"
        >
          <RelayLogo tone="cream" />
        </button>
      </div>

      <div className="border-b-2 border-lined p-4">
        <RailLiveCard />
      </div>

      <nav
        aria-label="App sections"
        className="scroll-thin flex flex-1 flex-col gap-1 overflow-y-auto p-3"
      >
        {NAV.map(({ screen: target, label, Icon }) => {
          const active = navKey === target;
          return (
            <button
              key={target}
              type="button"
              onClick={() => goScreen(target)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "mlabel flex items-center gap-1.5 rounded-lg border-2 px-3 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime",
                active
                  ? "border-lime bg-lime text-graphite"
                  : "border-transparent text-foam hover:bg-panel2 hover:text-cream"
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 text-left">{label}</span>
            </button>
          );
        })}

        <div className="my-2 h-px bg-lined" aria-hidden />

        <button
          type="button"
          onClick={() => goScreen("notifications")}
          aria-current={screen === "notifications" ? "page" : undefined}
          className={cn(
            "mlabel flex items-center gap-1.5 rounded-lg border-2 px-3 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime",
            screen === "notifications"
              ? "border-lime bg-lime text-graphite"
              : "border-transparent text-foam hover:bg-panel2 hover:text-cream"
          )}
        >
          <Bell className="size-4 shrink-0" aria-hidden />
          <span className="flex-1 text-left">ALERTS</span>
          <UnreadBadge count={unread} />
        </button>
      </nav>

      <div className="border-t-2 border-lined p-4">
        <div className="mb-3">
          <LiveDot tone="lime" label="SOMNIA · SHANNON" />
        </div>
        <NavWallet />
      </div>
    </aside>
  );
}

/* ── desktop broadcast status bar ────────────────────────────── */

function BroadcastBar() {
  const screen = useRelay((s) => s.screen);
  const liveLap = useRelay((s) => s.liveLap);
  const bankroll = useRelay((s) => s.bankroll);
  const streak = useRelay((s) => s.streak.current);
  const lastResult = useRelay((s) => s.lastResult);
  const resultSeen = useRelay((s) => s.resultSeen);
  const openResult = useRelay((s) => s.openResult);
  const side = liveLap?.position?.side ?? null;

  return (
    <header className="hidden h-14 shrink-0 items-center gap-5 border-b-2 border-lined bg-graphite px-6 lg:flex">
      <span className="mlabel shrink-0 text-foam">{KICKER[screen]}</span>

      <div className="ml-auto flex min-w-0 items-center gap-4">
        <NavWallet />
        <Divider />
        {liveLap ? (
          <>
            <LiveDot tone="lime" label={`${liveLap.market.asset} UP/DOWN`} />
            <Divider />
            <span className="data w-[3.4rem] text-right tabular-nums text-sm text-cream">
              {countdown(liveLap.countdownMs)}
            </span>
            {side ? (
              <span
                className={cn(
                  "data rounded-md border-2 px-2 py-0.5 text-xs font-semibold",
                  side === "UP"
                    ? "border-lime bg-lime text-graphite"
                    : "border-ember bg-ember text-cream"
                )}
              >
                {side === "UP" ? "▲ UP" : "▼ DOWN"}
              </span>
            ) : (
              <span className="mlabel text-foam/50">—</span>
            )}
            <Divider />
            <span className="data text-sm text-cream">{money(bankroll)}</span>
            <Divider />
            <span className="flex items-center gap-1.5" aria-label={`Streak ×${streak}`}>
              <FlameMark className="h-3.5 w-auto" animated={streak > 0} />
              <span className="data text-sm text-cream">×{streak}</span>
            </span>
          </>
        ) : (
          <LiveDot tone="cream" label="RUNNER WAITING" />
        )}

        {lastResult && !resultSeen && (
          <button
            type="button"
            onClick={openResult}
            className="mlabel flex items-center gap-1.5 rounded-lg border-2 border-flame px-2.5 py-1.5 text-flame transition-colors hover:bg-flame hover:text-graphite focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
            aria-label={`Open lap ${lastResult.lap} result`}
          >
            <FlameMark className="h-3.5 w-auto" />
            LAP {lastResult.lap} RESULT
          </button>
        )}
      </div>
    </header>
  );
}

/* ── mobile chrome ───────────────────────────────────────────── */

function MobileTopBar() {
  const go = useRelay((s) => s.go);
  const goScreen = useRelay((s) => s.goScreen);
  const unread = useRelay((s) => selectUnread(s.notifications));

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b-2 border-lined bg-graphite px-4 lg:hidden">
      <button
        type="button"
        onClick={() => go("landing")}
        aria-label="RELAY — back to landing"
        className="grid size-11 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-lime"
      >
        <RelayLogo tone="cream" compact />
      </button>
      <div className="flex min-w-0 items-center gap-1.5" aria-label="Wallet">
        <NavWallet />
      </div>
      <button
        type="button"
        onClick={() => goScreen("notifications")}
        aria-label={unread > 0 ? `Alerts, ${unread} unread` : "Alerts"}
        className="relative grid size-11 place-items-center rounded-lg text-foam transition-colors hover:bg-panel2 hover:text-cream focus-visible:outline-2 focus-visible:outline-lime"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5">
            <UnreadBadge count={unread} />
          </span>
        )}
      </button>
    </header>
  );
}

function MoreRow({
  Icon,
  label,
  onClick,
  badge,
}: {
  Icon: LucideIcon;
  label: string;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mlabel flex min-h-[44px] items-center gap-3 rounded-xl border-2 border-lined bg-panel2/50 px-4 py-3 text-cream transition-colors hover:border-foam focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
    >
      <Icon className="size-4 shrink-0 text-foam" aria-hidden />
      <span className="flex-1 text-left">{label}</span>
      {badge != null && badge > 0 && <UnreadBadge count={badge} />}
    </button>
  );
}

function MobileTabBar() {
  const screen = useRelay((s) => s.screen);
  const goScreen = useRelay((s) => s.goScreen);
  const unread = useRelay((s) => selectUnread(s.notifications));
  const [moreOpen, setMoreOpen] = useState(false);
  const navKey = navKeyFor(screen);

  const items: { key: string; label: string; Icon: LucideIcon; target?: AppScreen }[] = [
    { key: "home", label: "HOME", Icon: Activity, target: "home" },
    { key: "history", label: "TAPE", Icon: ScrollText, target: "history" },
    { key: "live", label: "LIVE", Icon: Radio, target: "live" },
    { key: "arena", label: "ARENA", Icon: Trophy, target: "arena" },
    { key: "more", label: "MORE", Icon: Menu },
  ];

  return (
    <>
      <nav
        aria-label="App sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-lined bg-graphite/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <div className="grid grid-cols-5 px-1">
          {items.map(({ key, label, Icon, target }) => {
            if (key === "live") {
              const active = screen === "live";
              return (
                <div key={key} className="flex items-start justify-center">
                  <button
                    type="button"
                    onClick={() => goScreen("live")}
                    aria-label="Live lap"
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "-mt-6 grid size-12 place-items-center rounded-full border-2 bg-lime text-graphite hardshadow-d transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime",
                      active ? "border-cream" : "border-lime"
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </button>
                </div>
              );
            }
            const active = target != null && navKey === target;
            return (
              <button
                key={key}
                type="button"
                onClick={() => (target ? goScreen(target) : setMoreOpen(true))}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-lg py-2 focus-visible:outline-2 focus-visible:outline-lime",
                  active ? "text-lime" : "text-foam"
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="mlabel text-[9px]">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-t-2 border-lined bg-panel px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="mlabel text-foam">MORE</SheetTitle>
          <SheetDescription className="sr-only">Additional sections</SheetDescription>
          <div className="mt-2 grid gap-2">
            <MoreRow
              Icon={Rocket}
              label="DEPLOY RUNNER"
              onClick={() => {
                setMoreOpen(false);
                goScreen("deploy");
              }}
            />
            <MoreRow
              Icon={BarChart3}
              label="ANALYTICS"
              onClick={() => {
                setMoreOpen(false);
                goScreen("analytics");
              }}
            />
            <MoreRow
              Icon={Settings2}
              label="SETTINGS"
              onClick={() => {
                setMoreOpen(false);
                goScreen("settings");
              }}
            />
            <MoreRow
              Icon={Bell}
              label="ALERTS"
              badge={unread}
              onClick={() => {
                setMoreOpen(false);
                goScreen("notifications");
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ── shell ───────────────────────────────────────────────────── */

export function AppShell() {
  const screen = useRelay((s) => s.screen);
  const Screen = SCREENS[screen] ?? MyRunnerScreen;

  return (
    <div className="grain grain-d h-dvh w-full overflow-hidden bg-graphite text-cream">
      <div className="flex h-full flex-col">
        <MobileTopBar />
        <div className="flex min-h-0 flex-1">
          <Rail />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <BroadcastBar />
            <main className="scroll-thin min-h-0 flex-1 overflow-y-auto">
              <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
                <motion.div
                  key={screen}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                >
                  <Screen />
                </motion.div>
              </div>
            </main>
          </div>
        </div>
        <MobileTabBar />
      </div>
    </div>
  );
}
