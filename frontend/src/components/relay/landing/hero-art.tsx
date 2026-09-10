"use client";

/**
 * RELAY landing — HERO ART.
 * An illustrated relay world, built as inline SVG (no images):
 * sweeping dashed lanes, a capsule-bodied runner carrying the glowing baton
 * (race bib = live lap number), floating market-window cards with live store
 * prices, a signal wave, a start flag and a measurement ruler.
 * Flat palette fills + ink outlines; the paper grain shows through.
 */

import { cn } from "@/lib/utils";
import { useRelay } from "@/lib/relay/engine/store";
import { cents } from "@/lib/relay/format";
import { FlameMark, VerifiedSeal } from "../identity/identity";

const INK = "#1a1610";
const CREAM = "#fcf9ef";
const PAPER2 = "#ece5d1";
const LINEN2 = "#e6e0cd";
const LIME = "#aae83c";
const EMBER = "#f0512a";
const FLAME = "#ffb224";
const INK2 = "#6b6250";
const INK3 = "#a89d84";

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

/* ── floating market-window card ────────────────────────────── */

interface WinCardProps {
  x: number;
  y: number;
  rot: number;
  asset: string;
  price: number;
  up: boolean;
  bar: number;
  tag?: "LIVE" | "NEXT" | "DOWN";
  delay?: string;
}

function WinCard({ x, y, rot, asset, price, up, bar, tag, delay = "0s" }: WinCardProps) {
  const btc = asset === "BTC";
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <g className="floaty" style={{ animationDelay: delay }}>
        <rect x="5" y="5" width="154" height="90" rx="12" fill={INK} opacity="0.85" />
        <rect width="154" height="90" rx="12" fill={CREAM} stroke={INK} strokeWidth="2.5" />
        {/* asset chip */}
        <circle cx="27" cy="29" r="14" fill={btc ? INK : "#f3efdd"} stroke={INK} strokeWidth="2.2" />
        {btc ? (
          <text
            x="27"
            y="34.5"
            textAnchor="middle"
            fontSize="14"
            fontWeight="800"
            fill="#f4f0e3"
            fontFamily="var(--font-display)"
          >
            ₿
          </text>
        ) : (
          <g transform="translate(16.6 17.6) scale(0.55)" fill={INK}>
            <path d="M20 8l7 12-7-3.4L13 20z" />
            <path d="M20 25l7-4.2-7 10-7-10z" opacity="0.75" />
            <path d="M20 8l-7 12 7-3.4z" opacity="0.55" />
          </g>
        )}
        <text x="49" y="23" fontSize="9.5" letterSpacing="1.5" fill={INK2} fontFamily="var(--font-data)">
          {asset} · UP OR DOWN
        </text>
        <text x="49" y="49" fontSize="23" fontWeight="600" fill={INK} fontFamily="var(--font-data)">
          {cents(price)}
        </text>
        {/* direction pip */}
        <path
          d={up ? "M126 28 l8 12 h-16 z" : "M126 40 l8 -12 h-16 z"}
          fill={up ? LIME : EMBER}
          stroke={INK}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* countdown bar */}
        <rect x="14" y="63" width="126" height="11" rx="5.5" fill={LINEN2} stroke={INK} strokeWidth="1.8" />
        <rect
          x="14"
          y="63"
          width={Math.max(8, 126 * clamp01(bar))}
          height="11"
          rx="5.5"
          fill={up ? LIME : EMBER}
          stroke={INK}
          strokeWidth="1.8"
        />
        <line x1="56" y1="61.5" x2="56" y2="75.5" stroke={INK3} strokeWidth="1.5" />
        <line x1="98" y1="61.5" x2="98" y2="75.5" stroke={INK3} strokeWidth="1.5" />
        {/* status tag */}
        {tag && (
          <g>
            <rect
              x={tag === "LIVE" ? 104 : 108}
              y="-11"
              width={tag === "LIVE" ? 50 : 46}
              height="19"
              rx="6"
              fill={tag === "LIVE" ? LIME : PAPER2}
              stroke={INK}
              strokeWidth="2"
            />
            {tag === "LIVE" && <circle cx="114" cy="-1.5" r="3" fill={INK} className="blink" />}
            <text
              x={tag === "LIVE" ? 134 : 131}
              y="2"
              textAnchor="middle"
              fontSize="9"
              letterSpacing="1.3"
              fontWeight="700"
              fill={INK}
              fontFamily="var(--font-data)"
            >
              {tag}
            </text>
          </g>
        )}
      </g>
    </g>
  );
}

/* ── the runner (origin at ground level, faces right) ────────── */

function Runner({ lapNumber }: { lapNumber: number }) {
  return (
    <g className="runner-bob">
      {/* ground shadow */}
      <ellipse cx="14" cy="10" rx="84" ry="9" fill={INK} opacity="0.1" />
      {/* motion lines */}
      <g stroke={INK} strokeWidth="3.5" strokeLinecap="round" opacity="0.38">
        <line x1="-96" y1="-92" x2="-64" y2="-92" />
        <line x1="-112" y1="-66" x2="-74" y2="-66" />
        <line x1="-88" y1="-40" x2="-62" y2="-40" />
      </g>
      {/* trail leg (kicked back) */}
      <path d="M4 -64 C -8 -46, -24 -36, -46 -30" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      {/* lead leg (reaching forward) */}
      <path d="M2 -62 C 16 -46, 34 -34, 54 -20" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d="M54 -20 L 70 -12" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      {/* back arm */}
      <path d="M-8 -106 C -24 -94, -36 -78, -42 -60" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      {/* torso */}
      <rect
        x="-27"
        y="-130"
        width="54"
        height="76"
        rx="27"
        fill={LIME}
        stroke={INK}
        strokeWidth="2.6"
        transform="rotate(12 0 -92)"
      />
      {/* race bib = live lap number */}
      <g transform="rotate(12 0 -92)">
        <rect x="-12" y="-118" width="26" height="17" rx="3.5" fill={CREAM} stroke={INK} strokeWidth="2" />
        <text x="1" y="-105.5" textAnchor="middle" fontSize="12" fontWeight="700" fill={INK} fontFamily="var(--font-data)">
          {lapNumber}
        </text>
      </g>
      {/* head + headband */}
      <circle cx="18" cy="-152" r="16.5" fill={CREAM} stroke={INK} strokeWidth="2.6" />
      <path d="M5 -157 C 12 -162, 26 -161, 32 -153" fill="none" stroke={FLAME} strokeWidth="6" strokeLinecap="round" />
      {/* front arm + hand */}
      <path d="M8 -108 C 26 -106, 44 -116, 58 -132" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      <circle cx="60" cy="-134" r="6.5" fill={CREAM} stroke={INK} strokeWidth="2.2" />
      {/* the glowing baton */}
      <g transform="translate(70 -150) rotate(-30)">
        <ellipse cx="22" cy="0" rx="37" ry="13" fill={LIME} opacity="0.25" />
        <rect x="0" y="-5.5" width="46" height="11" rx="5.5" fill={LIME} stroke={INK} strokeWidth="2.3" />
        <circle cx="9" cy="0" r="2.5" fill={INK} />
        <circle cx="23" cy="0" r="3" fill={FLAME} stroke={INK} strokeWidth="1.3" />
        <circle cx="37" cy="0" r="2.5" fill={INK} />
      </g>
      {/* speed ticks past the baton */}
      <g stroke={INK} strokeWidth="2.4" strokeLinecap="round" opacity="0.35">
        <line x1="118" y1="-176" x2="132" y2="-181" />
        <line x1="124" y1="-158" x2="136" y2="-162" />
      </g>
    </g>
  );
}

/* ── desktop hero art ───────────────────────────────────────── */

export function HeroArt({ className }: { className?: string }) {
  const liveLap = useRelay((s) => s.liveLap);
  const book = useRelay((s) => s.book);
  const calendar = useRelay((s) => s.calendar);

  const prob = liveLap?.probUp ?? 0.5;
  const lapNumber = liveLap?.number ?? 1;
  const liveAsset = liveLap?.market.asset ?? "BTC";
  const progress = liveLap
    ? clamp01(liveLap.windowElapsedMs / Math.max(1, liveLap.windowTotalMs))
    : 0.5;
  const ask = book.askUp[0]?.price ?? prob;
  const nextAsset = calendar[0]?.asset ?? (liveAsset === "BTC" ? "ETH" : "BTC");

  const rulerTicks = Array.from({ length: 29 }, (_, i) => 20 + i * 40);
  const rulerLabels = ["15M", "30M", "45M", "60M", "75M", "90M"];

  return (
    <svg viewBox="0 0 1160 640" className={className} aria-hidden>
      {/* sweeping lanes (outer / flowing / inner) */}
      <path
        d="M-60 500 C 240 440 520 360 700 240 C 830 155 1010 95 1240 70"
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeDasharray="16 12"
        opacity="0.5"
      />
      <path
        d="M-60 560 C 240 500 540 420 720 300 C 850 215 1030 155 1240 130"
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeDasharray="16 12"
        className="lane-flow"
      />
      <path
        d="M-60 620 C 240 560 560 480 740 360 C 870 275 1050 215 1240 190"
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeDasharray="16 12"
        opacity="0.32"
      />

      {/* start flag */}
      <line x1="110" y1="466" x2="110" y2="522" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M110 470 L 141 479 L 110 488 Z" fill={LIME} stroke={INK} strokeWidth="2" strokeLinejoin="round" />

      {/* floating market windows (live store prices) */}
      <WinCard x={260} y={88} rot={-6} asset={liveAsset} price={prob} up bar={progress} tag="LIVE" delay="0s" />
      <WinCard x={700} y={40} rot={4} asset={liveAsset} price={1 - prob} up={false} bar={0.62} tag="DOWN" delay="-1.7s" />
      <WinCard x={930} y={320} rot={-3} asset={nextAsset} price={ask} up bar={0.32} tag="NEXT" delay="-3.2s" />

      {/* the runner — bib wears the live lap number */}
      <g transform="translate(560 372) rotate(-4)">
        <Runner lapNumber={lapNumber} />
      </g>

      {/* signal wave */}
      <g>
        <circle cx="1050" cy="505" r="6" fill={INK} />
        <path d="M1050 479 A 26 26 0 0 0 1050 531" fill="none" stroke={INK} strokeWidth="2.2" opacity="0.5" className="blink" />
        <path
          d="M1050 461 A 44 44 0 0 0 1050 549"
          fill="none"
          stroke={INK}
          strokeWidth="2.2"
          opacity="0.34"
          className="blink"
          style={{ animationDelay: "0.4s" }}
        />
        <path
          d="M1050 443 A 62 62 0 0 0 1050 567"
          fill="none"
          stroke={INK}
          strokeWidth="2.2"
          opacity="0.2"
          className="blink"
          style={{ animationDelay: "0.8s" }}
        />
      </g>

      {/* measurement ruler */}
      <line x1="0" y1="612" x2="1160" y2="612" stroke={INK} strokeWidth="2" opacity="0.55" />
      {rulerTicks.map((x) => (
        <line
          key={x}
          x1={x}
          y1="612"
          x2={x}
          y2={(x - 20) % 160 === 0 ? "597" : "605"}
          stroke={INK}
          strokeWidth="1.6"
          opacity="0.5"
        />
      ))}
      {rulerLabels.map((t, i) => (
        <text
          key={t}
          x={180 + i * 160}
          y="633"
          textAnchor="middle"
          fontSize="9.5"
          letterSpacing="1.2"
          fill={INK3}
          fontFamily="var(--font-data)"
        >
          {t}
        </text>
      ))}
    </svg>
  );
}

/* ── mobile hero art (reduced complexity, stacked under the type) ── */

export function HeroArtMobile({ className }: { className?: string }) {
  const liveLap = useRelay((s) => s.liveLap);
  const lapNumber = liveLap?.number ?? 1;
  const prob = liveLap?.probUp ?? 0.5;
  const liveAsset = liveLap?.market.asset ?? "BTC";
  const progress = liveLap
    ? clamp01(liveLap.windowElapsedMs / Math.max(1, liveLap.windowTotalMs))
    : 0.5;

  return (
    <svg viewBox="0 0 640 360" className={className} aria-hidden>
      <path
        d="M-40 250 C 160 210 300 170 380 120 C 450 78 540 52 680 32"
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeDasharray="16 12"
        className="lane-flow"
      />
      {/* start flag */}
      <line x1="70" y1="212" x2="70" y2="258" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M70 216 L 98 224 L 70 232 Z" fill={LIME} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      {/* runner */}
      <g transform="translate(300 195) rotate(-4) scale(0.85)">
        <Runner lapNumber={lapNumber} />
      </g>
      {/* live window card */}
      <WinCard x={430} y={14} rot={-4} asset={liveAsset} price={prob} up bar={progress} tag="LIVE" delay="-1s" />
      {/* signal wave */}
      <circle cx="560" cy="300" r="5" fill={INK} />
      <path d="M560 278 A 22 22 0 0 0 560 322" fill="none" stroke={INK} strokeWidth="2" opacity="0.45" className="blink" />
      <path
        d="M560 264 A 36 36 0 0 0 560 336"
        fill="none"
        stroke={INK}
        strokeWidth="2"
        opacity="0.28"
        className="blink"
        style={{ animationDelay: "0.4s" }}
      />
      {/* ruler */}
      <line x1="0" y1="342" x2="640" y2="342" stroke={INK} strokeWidth="2" opacity="0.5" />
      {Array.from({ length: 8 }, (_, i) => 40 + i * 80).map((x) => (
        <line key={x} x1={x} y1="342" x2={x} y2="335" stroke={INK} strokeWidth="1.6" opacity="0.5" />
      ))}
    </svg>
  );
}

/* ── sticker overlays for the hero (real streak / verified) ─── */

export function StreakFlameSticker({ className }: { className?: string }) {
  const streak = useRelay((s) => s.streak.current);
  return (
    <div className={cn("sticker floaty rotate-[6deg] px-3.5 py-2.5 flex items-center gap-2.5", className)} aria-hidden>
      <FlameMark className="h-7 w-auto" animated />
      <span className="data text-2xl font-semibold leading-none">×{streak}</span>
      <span className="mlabel text-ink2">STREAK</span>
    </div>
  );
}

export function HeroSealSticker({ className }: { className?: string }) {
  return (
    <div className={cn("floaty rotate-[-9deg]", className)} aria-hidden>
      <VerifiedSeal size={84} />
    </div>
  );
}
