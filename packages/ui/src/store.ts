import {
  DEFAULT_SETTINGS,
  decisionId,
  localDateOf,
  localMinutesOf,
  toSubscriptionInput,
  type Decision,
  type DecisionChoice,
  type DueReminder,
  type LocalDate,
  type ReminderClock,
  type Settings,
  type Subscription,
  type SubscriptionInput,
} from "@still/core";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { DecideResult, StillClient } from "./client.js";

export interface StillState {
  status: "loading" | "ready" | "error";
  error: string | null;
  subscriptions: Subscription[];
  settings: Settings;
  decisions: Decision[];
  /** Civil date the views compute against; rolls over at local midnight. */
  today: LocalDate;
  /** Local date and minute, for "has notifyAt passed?" checks. Updates every minute. */
  clock: ReminderClock;
  /** Reminders waiting for a "Still using it?" card, most urgent first. */
  reminders: DueReminder[];
}

export interface UndoToken {
  subscriptionId: string;
  chargeDate: LocalDate;
  restore?: SubscriptionInput;
}

export interface StillActions {
  refresh(): Promise<void>;
  create(input: SubscriptionInput): Promise<Subscription>;
  update(id: string, input: SubscriptionInput): Promise<Subscription>;
  remove(id: string): Promise<void>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;
  /** Answers a charge; returns what's needed to undo it. */
  decide(subscriptionId: string, chargeDate: LocalDate, choice: DecisionChoice, snoozeUntil?: LocalDate): Promise<UndoToken>;
  undo(token: UndoToken): Promise<void>;
  enqueueReminders(reminders: DueReminder[]): void;
  dismissReminder(key: string): void;
  /** Stops the clock timer. */
  dispose(): void;
}

export type StillStore = StoreApi<StillState & StillActions>;

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

export function createStillStore(client: StillClient, now: () => Date = () => new Date()): StillStore {
  let timer: ReturnType<typeof setInterval> | null = null;
  let refreshing: Promise<void> | null = null;
  const readClock = (): ReminderClock => {
    const d = now();
    return { today: localDateOf(d), minutes: localMinutesOf(d) };
  };

  const store = createStore<StillState & StillActions>()((set, get) => ({
    status: "loading",
    error: null,
    subscriptions: [],
    settings: { ...DEFAULT_SETTINGS },
    decisions: [],
    today: readClock().today,
    clock: readClock(),
    reminders: [],

    refresh() {
      // Coalesce bursts (several `changed` broadcasts, focus + visibility…).
      refreshing ??= (async () => {
        try {
          const snapshot = await client.snapshot();
          const clock = readClock();
          set({ status: "ready", error: null, clock, today: clock.today, ...snapshot });
        } catch (e) {
          set({ status: "error", error: e instanceof Error ? e.message : String(e) });
        } finally {
          refreshing = null;
        }
      })();
      return refreshing;
    },

    async create(input) {
      const record = await client.createSubscription(input);
      set({ subscriptions: upsert(get().subscriptions, record) });
      return record;
    },

    async update(id, input) {
      const record = await client.updateSubscription(id, input);
      set({ subscriptions: upsert(get().subscriptions, record) });
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

    async decide(subscriptionId, chargeDate, choice, snoozeUntil) {
      const before = get().subscriptions.find((s) => s.id === subscriptionId);
      const result: DecideResult = await client.decide(subscriptionId, chargeDate, choice, snoozeUntil);
      set({
        subscriptions: upsert(get().subscriptions, result.subscription),
        decisions: upsert(get().decisions, result.decision),
        reminders: get().reminders.filter((r) => !(r.subscriptionId === subscriptionId && r.chargeDate === chargeDate)),
      });
      const changedSub = before && before.updatedAt !== result.subscription.updatedAt;
      return { subscriptionId, chargeDate, restore: changedSub ? toSubscriptionInput(before) : undefined };
    },

    async undo({ subscriptionId, chargeDate, restore }) {
      const subscription = await client.undoDecision(subscriptionId, chargeDate, restore);
      const id = decisionId(subscriptionId, chargeDate);
      set({
        decisions: get().decisions.filter((d) => d.id !== id),
        subscriptions: subscription ? upsert(get().subscriptions, subscription) : get().subscriptions,
      });
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
    const clock = readClock();
    store.setState(clock.today === store.getState().today ? { clock } : { clock, today: clock.today });
  }, 30_000);

  return store;
}
