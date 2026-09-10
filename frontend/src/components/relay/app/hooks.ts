"use client";

/** RELAY — small client hooks shared by the app shell + owned screens. */

import { useEffect, useRef, useState } from "react";

/** Media query subscription (SSR-safe: false until mounted). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/**
 * Direction a numeric value just moved in — drives the money/price
 * "flash" (brief lime/ember tick, ~750ms). null while static.
 * Uses the documented "adjust state during render" pattern so the
 * flash is visible on the same paint as the new value.
 */
export function useFlash(value: number): "up" | "down" | null {
  const [state, setState] = useState<{ prev: number; dir: "up" | "down" | null }>({
    prev: value,
    dir: null,
  });

  if (value !== state.prev) {
    setState({ prev: value, dir: value > state.prev ? "up" : "down" });
  }

  useEffect(() => {
    if (state.dir == null) return;
    const t = setTimeout(
      () => setState((s) => (s.dir == null ? s : { ...s, dir: null })),
      750
    );
    return () => clearTimeout(t);
  }, [state.dir]);

  return state.dir;
}
