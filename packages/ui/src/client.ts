import type { Channel, Decision, DecisionChoice, ExchangeRates, LocalDate, NotificationSettings, Settings, Snapshot, StillBackup, Subscription, SubscriptionInput } from "@still/core";

export interface DecideResult {
  decision: Decision;
  /** The subscription after the decision ("cancel" ends it). */
  subscription: Subscription;
}

/**
 * What the UI needs from a host. SiYuan implements it over kernel RPC; other
 * hosts (Obsidian, web, server) implement it over their own storage or HTTP.
 */
export interface StillClient {
  snapshot(): Promise<Snapshot>;
  createSubscription(input: SubscriptionInput): Promise<Subscription>;
  updateSubscription(id: string, input: SubscriptionInput): Promise<Subscription>;
  deleteSubscription(id: string): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  decide(subscriptionId: string, chargeDate: LocalDate, choice: DecisionChoice, snoozeUntil?: LocalDate): Promise<DecideResult>;
  /** Withdraws a decision; `restore` puts the subscription back as it was. */
  undoDecision(subscriptionId: string, chargeDate: LocalDate, restore?: SubscriptionInput): Promise<Subscription | null>;
  exportData?(): Promise<StillBackup>;
  importData?(backup: StillBackup): Promise<ImportResult>;
  /** Fetches fresh exchange rates now. */
  refreshRates?(): Promise<ExchangeRates | null>;
  /** Push channels; hosts without background delivery omit these. */
  getNotifications?(): Promise<NotificationSettings>;
  saveNotifications?(settings: NotificationSettings): Promise<NotificationSettings>;
  testChannel?(channel: Channel): Promise<{ ok: boolean; status: number; error?: string }>;
  deviceInfo?(): Promise<{ deviceId: string; name: string; os: string }>;
  /** Notebooks for the daily-note option (SiYuan: entries go to a chosen notebook's daily note). */
  listNotebooks?(): Promise<{ id: string; name: string }[]>;
  /** The host writes entries into its own daily note (Obsidian); no notebook to choose. */
  readonly dailyNotes?: boolean;
}

export interface ImportResult {
  subscriptions: number;
  decisions: number;
  skipped: number;
}

/** Host integrations the UI may use when available. */
export interface StillHost {
  openUrl(url: string): void;
  confirm(message: string): Promise<boolean>;
  /** Opens the full manager view (e.g. a tab), if the host has one. */
  openManager?(): void;
  /** Saves a file for the user; defaults to a browser download. */
  saveFile?(filename: string, content: string, mime: string): void;
}
