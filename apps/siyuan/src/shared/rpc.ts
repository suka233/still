/** JSON-RPC contract between the Still frontend and kernel plugin. */
import type { DueReminder } from "@still/core";

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
  // kernel → frontend notifications
  notifyChanged: "changed",
  notifyRemindersDue: "reminders-due",
} as const;

export interface RemindersDueParams {
  reminders: DueReminder[];
}

/** Errors are thrown as JSON in `Error.message` so the frontend can show field errors. */
export interface RpcErrorData {
  kind: "validation" | "not-found";
  errors: string[];
}
