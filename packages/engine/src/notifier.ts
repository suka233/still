/**
 * Delivery that doesn't need an open view: push channels and daily-note
 * entries. Each is logged in the shared delivery log so it happens once across
 * devices; only the device chosen as sender delivers.
 */
import {
  buildChannelRequest,
  chargesInRange,
  formatMoneyPlain,
  isDelivered,
  parseTimeOfDay,
  type Channel,
  type DueReminder,
  type NotificationSettings,
  type PushMessage,
  type Settings,
  type StillRepository,
  type Subscription,
} from "@still/core";
import type { EngineHost } from "./host.js";

/** Keys in the shared delivery log, namespaced so app and push delivery stay independent. */
export const pushKey = (reminderKey: string) => `push|${reminderKey}`;
export const journalKey = (subscriptionId: string, date: string) => `journal|${subscriptionId}:${date}:t0`;

/** After a failed push, wait this long before trying the same reminder again. */
const RETRY_MS = 15 * 60_000;

export interface ChannelTestResult {
  ok: boolean;
  status: number;
  error?: string;
}

export function isSender(notifications: NotificationSettings, deviceId: string): boolean {
  return notifications.sender === "any" || notifications.sender === deviceId;
}

export class Notifier {
  readonly #retryAfter = new Map<string, number>();

  constructor(
    private readonly repo: StillRepository,
    private readonly host: EngineHost,
  ) {}

  #when(daysLeft: number): string {
    const { t } = this.host;
    if (daysLeft <= 0) return t("push.today");
    if (daysLeft === 1) return t("push.tomorrow");
    return t("push.inDays", { n: daysLeft });
  }

  reminderMessage(reminder: DueReminder, sub: Subscription): PushMessage {
    const { t } = this.host;
    const price = formatMoneyPlain(sub.price);
    return {
      title: t(reminder.kind === "trial-ending" ? "push.trialTitle" : "push.title", { name: sub.name, when: this.#when(reminder.daysLeft) }),
      body: t("push.body", { price }),
      url: sub.cancelUrl ?? sub.url ?? undefined,
      data: {
        event: "reminder",
        kind: reminder.kind,
        subscription: { id: sub.id, name: sub.name, price: sub.price, cycle: sub.cycle },
        chargeDate: reminder.chargeDate,
        daysLeft: reminder.daysLeft,
      },
    };
  }

  testMessage(): PushMessage {
    const { t } = this.host;
    return { title: t("push.testTitle"), body: t("push.testBody"), data: { event: "test" } };
  }

  async send(channel: Channel, message: PushMessage): Promise<ChannelTestResult> {
    try {
      const req = buildChannelRequest(channel, message);
      const res = await this.host.http({ url: req.url, method: req.method, headers: req.headers, json: req.json, timeoutMs: 10_000 });
      // Providers may echo credentials in their response; only expose the status.
      return isDelivered(res.status) ? { ok: true, status: res.status } : { ok: false, status: res.status, error: `Push request failed (HTTP ${res.status})` };
    } catch {
      // Transport errors may also include the complete request URL or headers.
      return { ok: false, status: 0, error: "Push request failed" };
    }
  }

  /** Pushes due reminders through every enabled channel; each reminder at most once. */
  async pushReminders(due: readonly DueReminder[], subscriptions: readonly Subscription[]) {
    const notifications = await this.repo.getNotifications();
    const channels = notifications.channels.filter((c) => c.enabled);
    const deviceId = this.host.device.deviceId;
    if (!channels.length || !due.length || !isSender(notifications, deviceId)) return;
    const delivered = await this.repo.readDelivered();
    const now = Date.now();
    const sent: string[] = [];
    for (const reminder of due) {
      const key = pushKey(reminder.key);
      if (delivered.has(key) || (this.#retryAfter.get(key) ?? 0) > now) continue;
      const sub = subscriptions.find((s) => s.id === reminder.subscriptionId);
      if (!sub) continue;
      const message = this.reminderMessage(reminder, sub);
      const results = await Promise.all(channels.map((c) => this.send(c, message)));
      if (results.some((r) => r.ok)) {
        sent.push(key);
        this.#retryAfter.delete(key);
      } else {
        this.#retryAfter.set(key, now + RETRY_MS);
        await this.host.log.warn(`push for ${sub.name} failed on every channel`, JSON.stringify(results));
      }
    }
    if (sent.length) await this.repo.markDelivered(deviceId, sent);
  }

  /** Writes today's charges into the daily note once notifyAt has passed. */
  async journalCharges(subscriptions: readonly Subscription[], settings: Settings, clock: { today: string; minutes: number }) {
    const journalHost = this.host.journal;
    if (!journalHost) return;
    const notifications = await this.repo.getNotifications();
    const { journal } = notifications;
    if (!journal.enabled || !journalHost.canWrite(journal) || !isSender(notifications, this.host.device.deviceId)) return;
    if (clock.minutes < parseTimeOfDay(settings.notifyAt)) return;
    const today = chargesInRange(subscriptions.filter((s) => s.status === "active"), clock.today, clock.today);
    if (!today.length) return;
    const delivered = await this.repo.readDelivered();
    const written: string[] = [];
    for (const { subscription: sub, date } of today) {
      const key = journalKey(sub.id, date);
      if (delivered.has(key)) continue;
      const line = this.host.t("journal.charge", { name: sub.name, price: formatMoneyPlain(sub.price) });
      if (await journalHost.append(journal, line)) written.push(key);
    }
    if (written.length) await this.repo.markDelivered(this.host.device.deviceId, written);
  }

  /** Notes a "not renewing" decision in today's daily note. */
  async journalCancellation(sub: Subscription) {
    const journalHost = this.host.journal;
    if (!journalHost) return;
    const { journal } = await this.repo.getNotifications();
    if (!journal.enabled || !journalHost.canWrite(journal)) return;
    await journalHost.append(journal, this.host.t("journal.cancel", { name: sub.name, price: formatMoneyPlain(sub.price) }));
  }
}
