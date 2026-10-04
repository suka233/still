import type { Decision, DecisionChoice, LocalDate, Settings, Snapshot, Subscription, SubscriptionInput } from "@still/core";

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
}

/** Host integrations the UI may use when available. */
export interface StillHost {
  openUrl(url: string): void;
  confirm(message: string): Promise<boolean>;
}
