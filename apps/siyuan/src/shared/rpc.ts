/** JSON-RPC contract between the Still frontend and kernel plugin. */
import type { Decision, DueReminder, Subscription } from "@still/core";

export type { Snapshot } from "@still/core";

export const RPC = {
  // frontend → kernel calls
  snapshot: "snapshot",
  createSubscription: "createSubscription",
  updateSubscription: "updateSubscription",
  deleteSubscription: "deleteSubscription",
  updateSettings: "updateSettings",
  pendingReminders: "pendingReminders",
  claimReminders: "claimReminders",
  decide: "decide",
  undoDecision: "undoDecision",
  refreshRates: "refreshRates",
  exportData: "exportData",
  importData: "importData",
  // kernel → frontend notifications
  notifyChanged: "changed",
  notifyRemindersDue: "reminders-due",
} as const;

export interface DecideResult {
  decision: Decision;
  /** The subscription after the decision (changed for "cancel"). */
  subscription: Subscription;
}

export interface RemindersDueParams {
  reminders: DueReminder[];
}

export interface ImportResult {
  subscriptions: number;
  decisions: number;
  skipped: number;
}

/** Errors are thrown as JSON in `Error.message` so the frontend can show field errors. */
export interface RpcErrorData {
  kind: "validation" | "not-found";
  errors: string[];
}
