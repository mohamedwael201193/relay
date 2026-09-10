"use client";

/**
 * RELAY — ExpectedVsRealized.
 * The calibration card: model-expected per-lap edge vs what the tape
 * actually delivered, with a ratio bar (lime above model, ember below)
 * and an honest footnote — the model number is a placeholder, the tape
 * is real.
 */

import { motion } from "framer-motion";
import { money } from "@/lib/relay/format";
import { CH, ChartEmpty, ChartPanel, ChartSummary } from "./kit";

interface Props {
  expected: number;
  realized: number;
  laps: number;
  ariaSummary: string;
  className?: string;
}

export function ExpectedVsRealized({ expected, realized, laps, ariaSummary, className }: Props) {
  const ratio = expected > 0 ? realized / expected : 0;
  const clamped = Math.min(ratio, 2);
  const above = ratio >= 1;
  /** position on the 0×..2× scale, as a fraction of the track */
  const pos = Math.max(0, Math.min(1, clamped / 2));

  return (
    <ChartPanel
      label="CALIBRATION · EXPECTED VS REALIZED"
      className={className}
      legend={
        <span className="data text-[0.62rem] text-foam/60">
          model edge is a stand-in — fills and receipts are Shannon
        </span>
      }
    >
      <ChartSummary text={ariaSummary} />
      {laps === 0 ? (
        <ChartEmpty height={140} note="calibration needs settled laps" />
      ) : (
        <div className="px-5 pb-4 pt-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mlabel text-foam/70">EXPECTED / LAP</div>
              <div className="data mt-1.5 text-3xl font-semibold leading-none text-cream">
                {money(expected)}
              </div>
              <div className="data mt-1.5 text-[0.6rem] text-foam/60">
                MEAN STAKE × 2.1% MODEL EDGE
              </div>
            </div>
            <div>
              <div className="mlabel text-foam/70">REALIZED / LAP</div>
              <div
                className="data mt-1.5 text-3xl font-semibold leading-none"
                style={{ color: realized > 0 ? CH.lime : realized < 0 ? CH.ember : CH.foam }}
              >
                {money(realized, { sign: true })}
              </div>
              <div className="data mt-1.5 text-[0.6rem] text-foam/60">
                MEAN NET PNL — FROM THE TAPE
              </div>
            </div>
          </div>

          {/* ratio bar: 0× .. 2×, marker at 1× */}
          <div className="mt-5">
            <div className="flex items-baseline justify-between">
              <span className="mlabel text-foam/70">REALIZED ÷ EXPECTED</span>
              <span
                className="data text-sm font-semibold"
                style={{ color: above ? CH.lime : CH.ember }}
              >
                {ratio >= 100 ? `${ratio.toFixed(0)}×` : `${ratio.toFixed(1)}×`}
                {ratio > 2 ? " (CLAMPED)" : ""}
              </span>
            </div>
            <div className="relative mt-2.5 h-3.5 rounded-full border-2 border-lined bg-panel2/70">
              {/* 1× marker */}
              <span className="absolute inset-y-0.5 left-1/2 w-0.5 -translate-x-1/2 bg-foam/60" aria-hidden />
              {/* fill from 1× to the ratio position */}
              <motion.span
                className="absolute inset-y-0.5 rounded-[3px]"
                style={{
                  background: above ? CH.lime : CH.ember,
                  left: above ? "50%" : `${pos * 100}%`,
                  right: above ? undefined : "50%",
                  opacity: 0.9,
                }}
                initial={{ width: 0 }}
                whileInView={{ width: above ? `${Math.max(0, pos - 0.5) * 100}%` : `${(0.5 - pos) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
                aria-hidden
              />
              {/* ratio marker dot */}
              <motion.span
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                style={{
                  borderColor: above ? CH.lime : CH.ember,
                  background: CH.graphite,
                  left: `${pos * 100}%`,
                }}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
                aria-hidden
              />
            </div>
            <div className="mt-1.5 flex justify-between">
              <span className="mlabel text-foam/50">0×</span>
              <span className="mlabel text-foam/50">1× MODEL</span>
              <span className="mlabel text-foam/50">2×</span>
            </div>
          </div>

          <div className="mt-4 border-t-2 border-lined/70 pt-3">
            <div className="data text-[0.65rem] leading-relaxed text-foam/70">
              Over {laps} settled lap{laps === 1 ? "" : "s"} the tape {above ? "ran ahead of" : "trailed"} the
              model edge — which is a stand-in number here. The receipts are not.
            </div>
          </div>
        </div>
      )}
    </ChartPanel>
  );
}
