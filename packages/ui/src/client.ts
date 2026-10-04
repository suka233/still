import type { Settings, Snapshot, Subscription, SubscriptionInput } from "@still/core";

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
}

/** Host integrations the UI may use when available. */
export interface StillHost {
  openUrl(url: string): void;
  confirm(message: string): Promise<boolean>;
  toast?(message: string): void;
}
