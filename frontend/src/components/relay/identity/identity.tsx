"use client";

/**
 * RELAY — identity system.
 * Logo, asset icons, sticker marks, runner glyphs.
 * Ink outlines + flat lime/ember/flame fills + paper grain = the house style.
 */

import { cn } from "@/lib/utils";

/* ── logo ───────────────────────────────────────────────────── */

export function RelayMark({ className, tone = "ink" }: { className?: string; tone?: "ink" | "cream" | "lime" }) {
  const stroke = tone === "ink" ? "#1a1610" : tone === "lime" ? "#aae83c" : "#f3efdd";
  return (
    <svg viewBox="0 0 40 32" fill="none" className={className} aria-hidden>
      {/* motion trails */}
      <path d="M2 22h10" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      <path d="M6 16h8" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
      {/* baton */}
      <g transform="rotate(-24 22 15)">
        <rect x="10" y="9" width="22" height="12" rx="6" fill={tone === "lime" ? "#aae83c" : stroke} />
        <rect x="10" y="9" width="22" height="12" rx="6" stroke={tone === "ink" ? "#1a1610" : stroke} strokeWidth="2" />
        {tone !== "lime" && <circle cx="16" cy="15" r="2.2" fill="#aae83c" />}
        {tone !== "lime" && <circle cx="24" cy="15" r="2.2" fill="#ffb224" />}
      </g>
    </svg>
  );
}

export function RelayLogo({
  className,
  tone = "ink",
  compact = false,
}: {
  className?: string;
  tone?: "ink" | "cream" | "lime";
  compact?: boolean;
}) {
  const fill = tone === "ink" ? "text-ink" : tone === "cream" ? "text-cream" : "text-lime";
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <RelayMark className="h-6 w-auto" tone={tone} />
      {!compact && (
        <span
          className={cn(
            "font-black wide tracking-[0.02em] leading-none text-[1.35rem]",
            fill
          )}
          style={{ fontFamily: "var(--font-display)" }}
        >
          RELAY
        </span>
      )}
    </span>
  );
}

/* ── asset icons ────────────────────────────────────────────── */

const ASSETS: Record<
  string,
  { label: string; ring: string; fill: string; text: string }
> = {
  BTC: { label: "BTC", ring: "#1a1610", fill: "#1a1610", text: "#f4f0e3" },
  ETH: { label: "ETH", ring: "#1a1610", fill: "#f3efdd", text: "#1a1610" },
  USDso: { label: "USDso", ring: "#1a1610", fill: "#aae83c", text: "#14110a" },
  tUSDC: { label: "tUSDC", ring: "#1a1610", fill: "#f4f0e3", text: "#1a1610" },
};

export function AssetIcon({
  asset,
  size = 28,
  className,
}: {
  asset: string;
  size?: number;
  className?: string;
}) {
  const meta = ASSETS[asset] ?? ASSETS.tUSDC;
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="img"
      aria-label={`${meta.label} token`}
    >
      <circle cx="20" cy="20" r="18.5" fill={meta.fill} stroke={meta.ring} strokeWidth="2.5" />
      {asset === "BTC" && (
        <text
          x="20"
          y="27.5"
          textAnchor="middle"
          fontSize="21"
          fontWeight="800"
          fill={meta.text}
          fontFamily="var(--font-display)"
        >
          ₿
        </text>
      )}
      {asset === "ETH" && (
        <g fill={meta.text}>
          <path d="M20 8l7 12-7-3.4L13 20z" />
          <path d="M20 25l7-4.2-7 10-7-10z" opacity="0.75" />
          <path d="M20 8l-7 12 7-3.4z" opacity="0.55" />
        </g>
      )}
      {(asset === "tUSDC" || asset === "USDso") && (
        <>
          <text
            x="20"
            y="26"
            textAnchor="middle"
            fontSize="16"
            fontWeight="900"
            fill={meta.text}
            fontFamily="var(--font-display)"
          >
            $
          </text>
          <text
            x="26.5"
            y="15"
            textAnchor="middle"
            fontSize="7"
            fontWeight="700"
            fill={meta.text}
            fontFamily="var(--font-data)"
          >
            {asset === "tUSDC" ? "t" : "so"}
          </text>
        </>
      )}
    </svg>
  );
}

/* ── marks / stickers ───────────────────────────────────────── */

export function FlameMark({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 24 28" fill="none" className={cn(className, animated && "flicker")} aria-hidden>
      <path
        d="M12 2c1.5 4-3.5 6.2-3.5 10.2 0 1.6.9 2.9 2.1 3.6-.2-1.7.6-3.1 1.9-4.1.4 2.9 3.6 3.8 3.6 7 0 2.6-1.9 4.3-4.1 4.3-2.5 0-4.5-1.9-4.5-4.8 0-1 .2-1.9.7-2.8C5.8 16.9 4 14.7 4 11.9 4 7.2 9.4 5.4 12 2z"
        fill="#ffb224"
        stroke="#14110a"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12.6 15.8c.8 1.2 2 2 2 3.7 0 1.6-1.1 2.7-2.6 2.7-1.4 0-2.5-1-2.5-2.5 0-1.7 1.7-2.5 3.1-3.9z"
        fill="#f0512a"
        stroke="#14110a"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShieldMark({ className, filled = true }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 26 28" fill="none" className={className} aria-hidden>
      <path
        d="M13 2l9 3.4v7.8c0 6-3.9 10.4-9 12.6-5.1-2.2-9-6.6-9-12.6V5.4L13 2z"
        fill={filled ? "#aae83c" : "transparent"}
        stroke="#14110a"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M8.6 13.8l3 3 5.6-6"
        stroke="#14110a"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BatonGlyph({ className, glow = false }: { className?: string; glow?: boolean }) {
  return (
    <svg viewBox="0 0 48 20" fill="none" className={className} aria-hidden>
      {glow && <ellipse cx="24" cy="10" rx="23" ry="9" fill="#aae83c" opacity="0.22" />}
      <g transform="rotate(-8 24 10)">
        <rect x="4" y="4" width="40" height="12" rx="6" fill="#aae83c" stroke="#14110a" strokeWidth="2" />
        <circle cx="11" cy="10" r="2.4" fill="#14110a" />
        <circle cx="24" cy="10" r="2.4" fill="#ffb224" stroke="#14110a" strokeWidth="1.2" />
        <circle cx="37" cy="10" r="2.4" fill="#14110a" />
      </g>
    </svg>
  );
}

export function VerifiedSeal({
  className,
  label = "VERIFIED",
  size = 92,
}: {
  className?: string;
  label?: string;
  size?: number;
}) {
  return (
    <div
      className={cn("relative grid place-items-center select-none", className)}
      style={{ width: size, height: size }}
      aria-label={`${label} seal`}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden>
        <circle cx="50" cy="50" r="46" fill="#aae83c" stroke="#14110a" strokeWidth="3" />
        <circle
          cx="50"
          cy="50"
          r="39"
          fill="none"
          stroke="#14110a"
          strokeWidth="1.5"
          strokeDasharray="3 4"
        />
        <path
          d="M36 51l9 9 19-20"
          stroke="#14110a"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span
        className="absolute -bottom-1.5 data text-[9px] font-semibold tracking-[0.18em] px-1.5 py-px rounded-sm"
        style={{ background: "#f3efdd", border: "1.5px solid #14110a", color: "#14110a" }}
      >
        {label}
      </span>
    </div>
  );
}

export function LapFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 26" fill="none" className={className} aria-hidden>
      <path d="M4 2v22" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M6 4h11l-3 4 3 4H6z"
        fill="#aae83c"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── runner glyph (avatar) ──────────────────────────────────── */

export function RunnerGlyph({
  hue,
  shape,
  size = 44,
  className,
  dark = false,
}: {
  hue: number;
  shape: number;
  size?: number;
  className?: string;
  dark?: boolean;
}) {
  const bg = `hsl(${hue} 62% ${dark ? "26%" : "82%"})`;
  const ink = dark ? "#f3efdd" : "#14110a";
  const accent = dark ? `hsl(${hue} 70% 62%)` : `hsl(${hue} 55% 42%)`;
  return (
    <div
      className={cn(
        "grid place-items-center rounded-xl border-2 shrink-0",
        className
      )}
      style={{
        width: size,
        height: size,
        background: bg,
        borderColor: ink,
        boxShadow: "2.5px 2.5px 0 rgba(0,0,0,0.45)",
      }}
      aria-hidden
    >
      <svg viewBox="0 0 40 40" width={size * 0.62} height={size * 0.62} fill="none">
        {shape === 0 && (
          <g stroke={ink} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 26l10-12 10 12" />
            <path d="M14 26l6-7 6 7" stroke={accent} />
          </g>
        )}
        {shape === 1 && (
          <g transform="rotate(-20 20 20)">
            <rect x="7" y="14" width="26" height="12" rx="6" fill={accent} stroke={ink} strokeWidth="2.6" />
            <circle cx="13" cy="20" r="2.4" fill={ink} />
            <circle cx="27" cy="20" r="2.4" fill={ink} />
          </g>
        )}
        {shape === 2 && (
          <g stroke={ink} strokeWidth="3" strokeLinecap="round">
            <path d="M7 15h20" />
            <path d="M7 20h26" stroke={accent} strokeWidth="4" />
            <path d="M7 25h14" />
          </g>
        )}
        {shape === 3 && (
          <g>
            <path
              d="M20 6c1.4 3.8-3.2 5.8-3.2 9.5 0 1.5.8 2.7 2 3.4-.2-1.6.5-2.9 1.7-3.8.4 2.7 3.3 3.5 3.3 6.5 0 2.4-1.7 4-3.8 4-2.3 0-4.1-1.7-4.1-4.4 0-.9.2-1.8.6-2.6-2.3-.5-3.9-2.5-3.9-5.1C12.6 10 17.6 8.3 20 6z"
              fill="#ffb224"
              stroke={ink}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </g>
        )}
      </svg>
    </div>
  );
}

/* ── up / down direction marks ──────────────────────────────── */

export function UpMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path
        d="M10 3l7 7h-4v7H7v-7H3l7-7z"
        fill="#aae83c"
        stroke="#14110a"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DownMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path
        d="M10 17l-7-7h4V3h6v7h4l-7 7z"
        fill="#f0512a"
        stroke="#14110a"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
