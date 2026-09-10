import type { LiveHandlers } from "./actions";

let handlers: LiveHandlers | null = null;

export function registerLiveHandlers(next: LiveHandlers | null): void {
  handlers = next;
}

export function getLiveHandlers(): LiveHandlers | null {
  return handlers;
}
