/**
 * Production is always live. Mock simulation is opt-in for local `next dev` only:
 * NEXT_PUBLIC_RELAY_DATA_SOURCE=mock
 * Production builds ignore that flag.
 */

export function isLiveMode(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return process.env.NEXT_PUBLIC_RELAY_DATA_SOURCE !== "mock";
}
