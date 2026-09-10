"use client";

/**
 * RELAY — the BATON PASS.
 * The signature transition: one lap hands the baton to the next.
 * Fires when the engine completes its re-arm. This is the moment
 * the product clicks emotionally — it must feel like a relay handoff,
 * not a page refresh.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useRelay } from "@/lib/relay/engine/store";
import { FlameMark, BatonGlyph, AssetIcon } from "../identity/identity";

const DURATION_MS = 2500;

export function BatonPass() {
  const baton = useRelay((s) => s.baton);
  const clearBaton = useRelay((s) => s.clearBaton);
  const streak = useRelay((s) => s.streak.current);
  const nextMarket = useRelay((s) => s.liveLap?.market.asset ?? "BTC");

  useEffect(() => {
    if (!baton) return;
    const t = setTimeout(() => clearBaton(), DURATION_MS);
    return () => clearTimeout(t);
  }, [baton, clearBaton]);

  return (
    <AnimatePresence>
      {baton && (
        <motion.div
          key={baton.key}
          className="fixed inset-0 z-[90] grid place-items-center cursor-pointer"
          style={{ background: "rgba(20,17,10,0.94)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          onClick={() => clearBaton()}
          role="button"
          aria-label="Baton pass — continue"
        >
          {/* whoosh lanes */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[18, 38, 62, 82].map((top, i) => (
              <motion.div
                key={top}
                className="absolute left-0 right-0 track-dash"
                style={{
                  top: `${top}%`,
                  color: i % 2 === 0 ? "#3a3320" : "#5a522f",
                  opacity: 0.5,
                }}
                initial={{ x: "-10%", opacity: 0 }}
                animate={{ x: ["-10%", "6%", "-2%"], opacity: [0, 0.6, 0.25] }}
                transition={{ duration: 1.2, delay: i * 0.08, ease: "easeInOut" }}
              />
            ))}
          </div>

          <div className="relative flex flex-col items-center px-6 text-center">
            {/* lap counter */}
            <div className="flex items-baseline gap-4 sm:gap-6">
              <motion.span
                className="data font-semibold text-foam/60 line-through decoration-ember/70 text-3xl sm:text-5xl"
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                LAP {baton.from}
              </motion.span>
              <motion.span
                className="text-ember text-2xl sm:text-4xl"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 14 }}
              >
                →
              </motion.span>
              <motion.span
                className="font-black wide text-lime text-5xl sm:text-7xl"
                style={{ fontFamily: "var(--font-display)" }}
                initial={{ x: 60, opacity: 0, scale: 0.9 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                LAP {baton.to}
              </motion.span>
            </div>

            {/* the baton flight */}
            <motion.div
              className="my-8 sm:my-10"
              initial={{ x: "-46vw", y: 30, rotate: -14, opacity: 0 }}
              animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
              transition={{
                delay: 0.32,
                type: "spring",
                stiffness: 90,
                damping: 12,
                mass: 1.1,
              }}
            >
              <BatonGlyph className="w-56 sm:w-80 h-auto" glow />
            </motion.div>

            {/* streak + next market */}
            <motion.div
              className="flex flex-col items-center gap-3"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.4 }}
            >
              <div className="flex items-center gap-2.5">
                <FlameMark className="w-6 h-7" animated />
                <span className="mlabel text-cream/90 text-xs">
                  STREAK ×{streak} · STAKE COMPOUNDED
                </span>
              </div>
              <div className="flex items-center gap-2 text-foam">
                <AssetIcon asset={nextMarket} size={20} />
                <span className="data text-sm">
                  NEXT WINDOW · {nextMarket} UP OR DOWN · 15M
                </span>
              </div>
              <span className="mlabel text-foam/50 mt-2">
                SOMNIA REACTIVITY RE-ARMED THE RUNNER · 0 CLICKS
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
