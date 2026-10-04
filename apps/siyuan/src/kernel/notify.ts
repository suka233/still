/**
 * Delivery that doesn't need an open window: push channels and daily-note
 * entries, sent from the kernel through SiYuan's forward proxy and API.
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
import { httpRequest } from "./http.js";

/** Keys in the shared delivery log, namespaced so app and push delivery stay independent. */
export const pushKey = (reminderKey: string) => `push|${reminderKey}`;
export const journalKey = (subscriptionId: string, date: string) => `journal|${subscriptionId}:${date}:t0`;

/** After a failed push, wait this long before trying the same reminder again. */
const RETRY_MS = 15 * 60_000;

function t(key: string, vars: Record<string, string | number> = {}): string {
  const i18n = (siyuan.plugin.i18n ?? {}) as Record<string, string>;
  let text = i18n[key] ?? key;
  for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  return text;
}

function when(daysLeft: number): string {
  if (daysLeft <= 0) return t("push.today");
  if (daysLeft === 1) return t("push.tomorrow");
  return t("push.inDays", { n: daysLeft });
}

export function reminderMessage(reminder: DueReminder, sub: Subscription): PushMessage {
  const price = formatMoneyPlain(sub.price);
  return {
    title: t(reminder.kind === "trial-ending" ? "push.trialTitle" : "push.title", { name: sub.name, when: when(reminder.daysLeft) }),
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

export function testMessage(): PushMessage {
  return { title: t("push.testTitle"), body: t("push.testBody"), data: { event: "test" } };
}

export async function sendToChannel(channel: Channel, message: PushMessage): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const req = buildChannelRequest(channel, message);
    const res = await httpRequest({ url: req.url, method: req.method, headers: req.headers, json: req.json, timeoutMs: 10_000 });
    return isDelivered(res.status) ? { ok: true, status: res.status } : { ok: false, status: res.status, error: res.body.slice(0, 300) };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

export function isSender(notifications: NotificationSettings, deviceId: string): boolean {
  return notifications.sender === "any" || notifications.sender === deviceId;
}

export class Notifier {
  readonly #retryAfter = new Map<string, number>();

  constructor(
    private readonly repo: StillRepository,
    private readonly deviceId: () => string,
  ) {}

  /** Pushes due reminders through every enabled channel; each reminder at most once. */
  async pushReminders(due: readonly DueReminder[], subscriptions: readonly Subscription[]) {
    const notifications = await this.repo.getNotifications();
    const channels = notifications.channels.filter((c) => c.enabled);
    if (!channels.length || !due.length || !isSender(notifications, this.deviceId())) return;
    const delivered = await this.repo.readDelivered();
    const now = Date.now();
    const sent: string[] = [];
    for (const reminder of due) {
      const key = pushKey(reminder.key);
      if (delivered.has(key) || (this.#retryAfter.get(key) ?? 0) > now) continue;
      const sub = subscriptions.find((s) => s.id === reminder.subscriptionId);
      if (!sub) continue;
      const message = reminderMessage(reminder, sub);
      const results = await Promise.all(channels.map((c) => sendToChannel(c, message)));
      if (results.some((r) => r.ok)) {
        sent.push(key);
        this.#retryAfter.delete(key);
      } else {
        this.#retryAfter.set(key, now + RETRY_MS);
        await siyuan.logger.warn(`push for ${sub.name} failed on every channel`, JSON.stringify(results));
      }
    }
    if (sent.length) await this.repo.markDelivered(this.deviceId(), sent);
  }

  /** Writes today's charges into the daily note once notifyAt has passed. */
  async journalCharges(subscriptions: readonly Subscription[], settings: Settings, clock: { today: string; minutes: number }) {
    const notifications = await this.repo.getNotifications();
    const { journal } = notifications;
    if (!journal.enabled || !journal.notebookId || !isSender(notifications, this.deviceId())) return;
    if (clock.minutes < parseTimeOfDay(settings.notifyAt)) return;
    const today = chargesInRange(subscriptions.filter((s) => s.status === "active"), clock.today, clock.today);
    if (!today.length) return;
    const delivered = await this.repo.readDelivered();
    const written: string[] = [];
    for (const { subscription: sub, date } of today) {
      const key = journalKey(sub.id, date);
      if (delivered.has(key)) continue;
      if (await appendToDailyNote(journal.notebookId, t("journal.charge", { name: sub.name, price: formatMoneyPlain(sub.price) }))) written.push(key);
    }
    if (written.length) await this.repo.markDelivered(this.deviceId(), written);
  }

  /** Notes a "not renewing" decision in today's daily note. */
  async journalCancellation(sub: Subscription) {
    const notifications = await this.repo.getNotifications();
    const { journal } = notifications;
    if (!journal.enabled || !journal.notebookId) return;
    await appendToDailyNote(journal.notebookId, t("journal.cancel", { name: sub.name, price: formatMoneyPlain(sub.price) }));
  }
}

async function appendToDailyNote(notebook: string, line: string): Promise<boolean> {
  try {
    const res = await siyuan.client.fetch("/api/block/appendDailyNoteBlock", {
      method: "POST",
      body: JSON.stringify({ notebook, dataType: "markdown", data: line }),
    });
    const json = (await res.json()) as { code: number; msg?: string };
    if (json.code !== 0) await siyuan.logger.warn("appendDailyNoteBlock failed", json.msg ?? String(json.code));
    return json.code === 0;
  } catch (e) {
    await siyuan.logger.warn("appendDailyNoteBlock failed", String(e));
    return false;
  }
}

export async function listNotebooks(): Promise<{ id: string; name: string }[]> {
  const res = await siyuan.client.fetch("/api/notebook/lsNotebooks", { method: "POST", body: "{}" });
  const json = (await res.json()) as { code: number; data?: { notebooks?: { id: string; name: string; closed: boolean }[] } };
  return (json.data?.notebooks ?? []).filter((n) => !n.closed).map((n) => ({ id: n.id, name: n.name }));
}
