import type {
  AppNotification,
  AppScreen,
  ArenaRunner,
  BoostRelationship,
  DemoState,
  Lap,
  LapResult,
  LiveLap,
  MarketWindow,
  RelayView,
  Runner,
  RunnerConfig,
  StreakState,
  Wallet,
  BookSnapshot,
} from "../types";

export type TxPhaseStatus =
  | "waiting"
  | "signing"
  | "submitting"
  | "confirming"
  | "confirmed"
  | "failed";

export interface TxPhase {
  label: string;
  status: TxPhaseStatus;
  hash?: string;
}

export interface RelayStore {
  view: RelayView;
  screen: AppScreen;
  selectedRunnerId: string | null;
  booted: boolean;

  wallet: Wallet;
  runner: Runner | null;
  config: RunnerConfig;
  draftConfig: RunnerConfig;

  laps: Lap[];
  streak: StreakState;
  bankroll: number;
  peakBankroll: number;
  startBankroll: number;

  liveLap: LiveLap | null;
  decision: { side: "UP" | "DOWN"; stake: number; entry: number } | null;
  priceHistory: { t: number; p: number }[];
  book: BookSnapshot;
  calendar: MarketWindow[];
  latencyMs: number;

  lastResult: LapResult | null;
  resultOpen: boolean;
  resultSeen: boolean;
  baton: { from: number; to: number; key: number } | null;

  arena: ArenaRunner[];
  boosts: BoostRelationship[];
  following: string[];
  notifications: AppNotification[];

  demo: DemoState;
  now: number;

  vaultAddress: string | null;
  backendState: string | null;
  apiError: string | null;
  txPhase: TxPhase | null;
  boostIntent: { leaderVault: string } | null;

  go: (view: RelayView, screen?: AppScreen) => void;
  goScreen: (screen: AppScreen) => void;
  selectRunner: (id: string) => void;
  syncHash: () => void;

  setDraftConfig: (patch: Partial<RunnerConfig>) => void;
  deployDraft: () => void;
  deployDraftAsync: () => Promise<void>;
  resetDemo: () => void;
  pauseRunner: () => void;
  resumeRunner: () => void;
  stopRunner: () => void;
  withdraw: () => void;
  chargeShields: () => void;

  boostRunner: (runnerId: string, amount: number) => void;
  toggleFollow: (runnerId: string) => void;

  openResult: () => void;
  dismissResult: () => void;
  markAllRead: () => void;
  clearBaton: () => void;

  demoTogglePanel: (open?: boolean) => void;
  demoSetSpeed: (speed: number) => void;
  demoForce: (outcome: "win" | "loss" | "void" | null) => void;
  demoTogglePause: () => void;
  demoSkip: () => void;

  tick: (realDtMs: number) => void;
}
