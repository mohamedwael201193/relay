"use client";

/**
 * RELAY — landing page (paper world).
 * Editorial story: hero → the problem → one window = one lap → how it works →
 * the autonomous loop → streaks & shields → safety → the arena → proof →
 * deploy. Every live number (lap, countdown, streak, bankroll, arena) comes
 * from the store; the art is hand-built inline SVG in the house style.
 */

import type { MouseEvent } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRelay } from "@/lib/relay/engine/store";
import { countdown } from "@/lib/relay/format";
import { RelayLogo } from "../identity/identity";
import { TickerStrip } from "../core/primitives";
import { ctaInk, ctaLink, ctaPrimary, focusRing, LandingMotionStyles, Reveal } from "./ui";
import { HeroArt, HeroArtMobile, HeroSealSticker, StreakFlameSticker } from "./hero-art";
import {
  ArenaSection,
  FinalCtaSection,
  HowItWorksSection,
  LoopSection,
  MentalModelSection,
  ProblemSection,
  ProofSection,
  SafetySection,
  StreaksSection,
} from "./sections";

const NAV_LINKS = [
  { label: "HOW IT WORKS", id: "how-it-works" },
  { label: "ARENA", id: "arena" },
  { label: "PROOF", id: "proof" },
];

function scrollToId(e: MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ── nav (sticky, paper, ink hairline) ──────────────────────── */

function LandingNav() {
  const go = useRelay((s) => s.go);
  const liveLap = useRelay((s) => s.liveLap);
  const asset = liveLap?.market.asset ?? "BTC";
  const cd = liveLap ? countdown(liveLap.countdownMs) : "--:--";

  return (
    <header className="sticky top-0 z-50 border-b border-ink bg-paper">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-8 lg:px-12">
        <a
          href="#/"
          onClick={(e) => {
            e.preventDefault();
            go("landing");
          }}
          className={focusRing}
          aria-label="RELAY — back to top"
        >
          <RelayLogo />
        </a>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Landing sections">
          {NAV_LINKS.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              onClick={(e) => scrollToId(e, l.id)}
              className="mlabel rounded-sm text-ink2 underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* live market chip — the nav is alive */}
          <button
            type="button"
            onClick={() => go("app", "live")}
            title="Watch the live lap"
            aria-label={`Live market: ${asset}, ${cd} to settlement`}
            className="flex items-center gap-2 rounded-full border-2 border-ink bg-cardp py-1.5 pl-2.5 pr-3 transition-colors hover:bg-linen2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            <span className="h-2 w-2 rounded-full bg-lime blink" aria-hidden />
            <span className="mlabel whitespace-nowrap text-ink">
              {asset} · {cd}
            </span>
          </button>
          <button type="button" onClick={() => go("app")} className={cn(ctaInk, "px-4 py-2.5 sm:px-5")}>
            OPEN THE APP
          </button>
        </div>
      </div>
    </header>
  );
}

/* ── hero proof strip (live store data) ─────────────────────── */

function HeroProofStrip() {
  const liveLap = useRelay((s) => s.liveLap);
  const streak = useRelay((s) => s.streak.current);

  if (!liveLap) {
    return <div className="mt-10 mlabel text-ink3">WINDOWS ROLLING · 5M / 15M / 1H</div>;
  }
  const sep = (
    <span className="text-ink3" aria-hidden>
      ·
    </span>
  );
  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="Live lap status">
      <span className="flex items-center gap-2 data text-sm font-semibold text-ink">
        <span className="h-2 w-2 rounded-full bg-lime blink" aria-hidden />
        LAP {liveLap.number} LIVE
      </span>
      {sep}
      <span className="data text-sm text-ink2">{liveLap.market.label.toUpperCase()}</span>
      {sep}
      <span className="data text-sm text-ink2">{countdown(liveLap.countdownMs)} TO SETTLEMENT</span>
      {sep}
      <span className="data text-sm font-semibold text-flamedeep">STREAK ×{streak}</span>
    </div>
  );
}

/* ── hero (full-viewport editorial composition) ─────────────── */

function Hero() {
  const go = useRelay((s) => s.go);
  return (
    <section className="relative overflow-hidden" aria-label="RELAY — the self-driving runner for DreamDEX event contracts">
      <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
        {/* illustrated relay world (desktop) — the type overlaps it */}
        <div className="pointer-events-none absolute right-[-3%] top-[3%] hidden w-[min(62vw,880px)] lg:block" aria-hidden>
          <HeroArt className="h-auto w-full" />
          <StreakFlameSticker className="absolute left-[45%] top-[48%]" />
          <HeroSealSticker className="bottom-[8%] right-[2%]" />
        </div>

        <div className="relative z-10 flex min-h-[68svh] flex-col justify-center pb-10 pt-12 lg:min-h-[calc(100svh-3.5rem)] lg:pb-16 lg:pt-20">
          <Reveal>
            <p className="serif-accent text-xl text-ink2 sm:text-2xl">Your market never sleeps.</p>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="hero-h1 mt-4 text-[clamp(3.4rem,9vw,8rem)] font-black wide leading-[0.92] tracking-[-0.01em]">
              <span className="block whitespace-nowrap">IT TRADES.</span>
              <span className="relative block w-max whitespace-nowrap">
                <span
                  aria-hidden
                  className="absolute bottom-[0.07em] left-[-0.04em] right-[-0.04em] h-[0.34em] -rotate-1 bg-lime"
                />
                <span className="relative">YOU LIVE.</span>
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="mt-7 max-w-md text-lg leading-relaxed text-ink2">
              RELAY is the self-driving runner for DreamDEX event contracts. Deploy once — your
              runner races every market window, builds a verified streak, and never asks you to
              click claim.
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="mt-9 flex flex-wrap items-center gap-6">
              <button type="button" className={ctaPrimary} onClick={() => go("app", "deploy")}>
                START YOUR RUNNER
              </button>
              <button type="button" className={ctaLink} onClick={() => go("app", "live")}>
                WATCH THE LIVE LAP
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          </Reveal>

          <Reveal delay={0.32}>
            <HeroProofStrip />
          </Reveal>
        </div>

        {/* illustrated world (mobile) — simplified, stacked under the type */}
        <div className="relative z-0 pb-8 lg:hidden" aria-hidden>
          <HeroArtMobile className="h-auto w-full" />
          <StreakFlameSticker className="right-2 top-2 rotate-[5deg]" />
        </div>
      </div>
    </section>
  );
}

/* ── footer (mt-auto sticky-footer rule) ────────────────────── */

function LandingFooter() {
  const go = useRelay((s) => s.go);
  return (
    <footer className="mt-auto">
      <div className="mx-auto max-w-[1200px] px-5 pb-5 pt-10 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <RelayLogo />
            <span className="hidden mlabel text-ink2 sm:inline">
              BUILT ON SOMNIA · DREAMDEX EVENT CONTRACTS
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Footer">
            {NAV_LINKS.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                onClick={(e) => scrollToId(e, l.id)}
                className="mlabel rounded-sm text-ink2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                {l.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => go("app")}
              className="mlabel rounded-sm text-ink2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              DEMO
            </button>
          </nav>
          <span className="mlabel text-ink2">© 2026 RELAY</span>
        </div>
        {/* bottom hairline + easter egg */}
        <div className="mt-7 flex items-center justify-between border-t border-ink/60 pt-3">
          <span className="mlabel text-ink3">PAPER EDITION · SHANNON TESTNET</span>
          <a
            href="#/demo"
            className="data rounded-sm text-[0.66rem] text-ink3 underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            psst — #/demo
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ── page ───────────────────────────────────────────────────── */

export function LandingPage() {
  return (
    <div className="paper grain bg-paper text-ink min-h-screen flex flex-col overflow-x-clip">
      <LandingMotionStyles />
      <LandingNav />
      <main>
        <Hero />
        <TickerStrip />
        <ProblemSection />
        <MentalModelSection />
        <HowItWorksSection />
        <LoopSection />
        <StreaksSection />
        <SafetySection />
        <ArenaSection />
        <ProofSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
