import { DEFAULT_SETTINGS, localDateOf, type DueReminder, type LocalDate, type Settings, type Subscription, type SubscriptionInput } from "@still/core";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { StillClient } from "./client.js";

export interface StillState {
  status: "loading" | "ready" | "error";
  error: string | null;
  subscriptions: Subscription[];
  settings: Settings;
  /** Civil date the views compute against; rolls over at local midnight. */
  today: LocalDate;
  /** Reminders waiting for a "Still using it?" decision, most urgent first. */
  reminders: DueReminder[];
}

export interface StillActions {
  refresh(): Promise<void>;
  create(input: SubscriptionInput): Promise<Subscription>;
  update(id: string, input: SubscriptionInput): Promise<Subscription>;
  remove(id: string): Promise<void>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;
  enqueueReminders(reminders: DueReminder[]): void;
  dismissReminder(key: string): void;
  /** Stops the midnight timer. */
  dispose(): void;
}

export type StillStore = StoreApi<StillState & StillActions>;

export function createStillStore(client: StillClient, now: () => Date = () => new Date()): StillStore {
  let timer: ReturnType<typeof setInterval> | null = null;

  const store = createStore<StillState & StillActions>()((set, get) => ({
    status: "loading",
    error: null,
    subscriptions: [],
    settings: { ...DEFAULT_SETTINGS },
    today: localDateOf(now()),
    reminders: [],

    async refresh() {
      try {
        const snapshot = await client.snapshot();
        set({ status: "ready", error: null, today: localDateOf(now()), ...snapshot });
      } catch (e) {
        set({ status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    },

    async create(input) {
      const record = await client.createSubscription(input);
      set({ subscriptions: [...get().subscriptions, record] });
      return record;
    },

    async update(id, input) {
      const record = await client.updateSubscription(id, input);
      set({ subscriptions: get().subscriptions.map((s) => (s.id === id ? record : s)) });
      return record;
    },

    async remove(id) {
      await client.deleteSubscription(id);
      set({
        subscriptions: get().subscriptions.filter((s) => s.id !== id),
        reminders: get().reminders.filter((r) => r.subscriptionId !== id),
      });
    },

    async saveSettings(patch) {
      const settings = await client.updateSettings(patch);
      set({ settings });
      return settings;
    },

    enqueueReminders(incoming) {
      const known = new Set(get().reminders.map((r) => r.key));
      const merged = [...get().reminders, ...incoming.filter((r) => !known.has(r.key))];
      set({ reminders: merged.sort((a, b) => a.daysLeft - b.daysLeft) });
    },

    dismissReminder(key) {
      set({ reminders: get().reminders.filter((r) => r.key !== key) });
    },

    dispose() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  }));

  timer = setInterval(() => {
    const today = localDateOf(now());
    if (today !== store.getState().today) store.setState({ today });
  }, 60_000);

  return store;
}
