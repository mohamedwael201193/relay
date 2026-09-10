export type LiveHandlers = {
  deploy: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  kill: () => Promise<void>;
  withdraw: () => Promise<void>;
};
