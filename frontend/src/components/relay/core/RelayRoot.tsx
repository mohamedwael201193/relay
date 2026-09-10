"use client";

/**
 * RELAY — root SPA shell.
 * One route ("/"), two worlds: the paper editorial landing and the
 * graphite broadcast app. Global overlays (baton pass, result,
 * demo panel) mount above both.
 */

import { useEffect } from "react";
import { useRelay, ensureEngine } from "@/lib/relay/engine/store";
import { isLiveMode } from "@/lib/relay/live/mode";
import { LandingPage } from "../landing/LandingPage";
import { AppShell } from "../app/AppShell";
import { BatonPass } from "./BatonPass";
import { ResultOverlay } from "../screens/ResultOverlay";
import { DemoPanel } from "../dev/DemoPanel";
import { RelayToasts } from "./primitives";

export function RelayRoot() {
  const view = useRelay((s) => s.view);
  const syncHash = useRelay((s) => s.syncHash);

  useEffect(() => {
    ensureEngine();
    syncHash();
    const onHash = () => syncHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [syncHash]);

  return (
    <div className="min-h-screen flex flex-col bg-graphite">
      {view === "landing" ? <LandingPage /> : <AppShell />}
      <ResultOverlay />
      <BatonPass />
      {!isLiveMode() ? <DemoPanel /> : null}
      <RelayToasts />
    </div>
  );
}
