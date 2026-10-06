import { NotFoundError, ValidationError, type DueReminder } from "@still/core";
import type { StillEngine } from "@still/engine";
import type { StillClient } from "@still/ui";

export interface ObsidianStillClient extends StillClient {
  pendingReminders(): Promise<DueReminder[]>;
  /** Returns the keys this device won; see the engine's `claimReminders`. */
  claimReminders(keys: string[]): Promise<string[]>;
}

/** Errors in the `{ kind, errors }` JSON shape the UI parses (same as SiYuan's RPC errors). */
function toClientError(e: unknown): Error {
  if (e instanceof ValidationError) return new Error(JSON.stringify({ kind: "validation", errors: e.errors }));
  if (e instanceof NotFoundError) return new Error(JSON.stringify({ kind: "not-found", errors: [e.message] }));
  return e instanceof Error ? e : new Error(String(e));
}

async function call<T>(fn: () => Promise<T> | T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw toClientError(e);
  }
}

/** StillClient that calls the engine directly: in Obsidian it runs in the plugin itself. */
export function createEngineClient(engine: StillEngine): ObsidianStillClient {
  return {
    dailyNotes: true,
    snapshot: () => call(() => engine.snapshot()),
    createSubscription: (input) => call(() => engine.createSubscription(input)),
    updateSubscription: (id, input) => call(() => engine.updateSubscription(id, input)),
    deleteSubscription: (id) => call(async () => void (await engine.deleteSubscription(id))),
    updateSettings: (patch) => call(() => engine.updateSettings(patch)),
    decide: (subscriptionId, chargeDate, choice, snoozeUntil) => call(() => engine.decide(subscriptionId, chargeDate, choice, snoozeUntil)),
    undoDecision: (subscriptionId, chargeDate, restore) => call(() => engine.undoDecision(subscriptionId, chargeDate, restore)),
    exportData: () => call(() => engine.exportData()),
    importData: (backup) => call(() => engine.importData(backup)),
    refreshRates: () => call(() => engine.refreshRates(true)),
    getNotifications: () => call(() => engine.getNotifications()),
    saveNotifications: (settings) => call(() => engine.saveNotifications(settings)),
    testChannel: (channel) => call(() => engine.testChannel(channel)),
    deviceInfo: () => call(() => engine.deviceInfo()),
    pendingReminders: () => call(() => engine.pendingReminders()),
    claimReminders: (keys) => call(() => engine.claimReminders(keys)),
  };
}
