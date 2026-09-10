"use client";

/**
 * RELAY — animated number (result moments).
 * Counts `from → to` with framer-motion's animate; format is caller-owned
 * (money, cents, …). Announces politely for screen readers.
 */

import { animate } from "framer-motion";
import { useEffect, useState } from "react";

export function CountUp({
  from,
  to,
  duration = 1,
  delay = 0,
  format,
  className,
  "aria-label": ariaLabel,
}: {
  from: number;
  to: number;
  duration?: number;
  delay?: number;
  format: (v: number) => string;
  className?: string;
  "aria-label"?: string;
}) {
  const [v, setV] = useState(from);

  useEffect(() => {
    const controls = animate(from, to, {
      duration,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setV(latest),
    });
    return () => controls.stop();
  }, [from, to, duration, delay]);

  return (
    <span className={className} aria-live="polite" aria-label={ariaLabel}>
      {format(v)}
    </span>
  );
}
