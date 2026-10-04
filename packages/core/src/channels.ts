/**
 * Push notification channels. Builders are pure: they turn a channel config
 * and a message into an HTTP request description, which each host executes
 * with its own HTTP client (SiYuan's forward proxy, fetch on a server…).
 */
import { formatMoneyAmount, type Money } from "./money.js";

export type ChannelKind =
  | "bark"
  | "ntfy"
  | "telegram"
  | "serverchan"
  | "wecom"
  | "dingtalk"
  | "feishu"
  | "discord"
  | "slack"
  | "gotify"
  | "webhook";

export const CHANNEL_KINDS: readonly ChannelKind[] = [
  "bark",
  "ntfy",
  "telegram",
  "serverchan",
  "wecom",
  "dingtalk",
  "feishu",
  "discord",
  "slack",
  "gotify",
  "webhook",
];

export interface ChannelField {
  key: string;
  /** Secret fields are masked in the UI. */
  secret?: boolean;
  optional?: boolean;
  /** Default shown as placeholder and used when empty. */
  placeholder?: string;
  /** Must start with https:// (or http://). */
  url?: boolean;
}

/** Fields each channel needs; labels/help live in the UI's i18n. */
export const CHANNEL_FIELDS: Record<ChannelKind, readonly ChannelField[]> = {
  bark: [
    { key: "key", secret: true },
    { key: "server", optional: true, placeholder: "https://api.day.app", url: true },
  ],
  ntfy: [
    { key: "topic" },
    { key: "server", optional: true, placeholder: "https://ntfy.sh", url: true },
    { key: "token", optional: true, secret: true },
  ],
  telegram: [{ key: "botToken", secret: true }, { key: "chatId" }],
  serverchan: [{ key: "sendKey", secret: true }],
  wecom: [{ key: "webhook", secret: true, url: true, placeholder: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…" }],
  dingtalk: [{ key: "webhook", secret: true, url: true, placeholder: "https://oapi.dingtalk.com/robot/send?access_token=…" }],
  feishu: [{ key: "webhook", secret: true, url: true, placeholder: "https://open.feishu.cn/open-apis/bot/v2/hook/…" }],
  discord: [{ key: "webhook", secret: true, url: true, placeholder: "https://discord.com/api/webhooks/…" }],
  slack: [{ key: "webhook", secret: true, url: true, placeholder: "https://hooks.slack.com/services/…" }],
  gotify: [{ key: "server", url: true, placeholder: "https://gotify.example.com" }, { key: "token", secret: true }],
  webhook: [{ key: "url", url: true, placeholder: "https://example.com/hook" }],
};

export interface Channel {
  id: string;
  kind: ChannelKind;
  /** User-facing label, e.g. "My iPhone". */
  name: string;
  enabled: boolean;
  config: Record<string, string>;
}

/**
 * Which device's kernel sends pushes. With several devices syncing one
 * workspace, letting only one of them send avoids duplicates.
 */
export interface NotificationSettings {
  channels: Channel[];
  /** A device ID, or "any". */
  sender: string;
  /** Write charges and cancellations into the SiYuan daily note. */
  journal: { enabled: boolean; notebookId: string | null };
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  channels: [],
  sender: "any",
  journal: { enabled: false, notebookId: null },
};

const URL_RE = /^https?:\/\/[^\s]+$/;

export function validateChannel(raw: unknown): { ok: true; value: Channel } | { ok: false; errors: string[] } {
  if (typeof raw !== "object" || raw === null) return { ok: false, errors: ["channel must be an object"] };
  const r = raw as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof r.id !== "string" || !/^[0-9a-zA-Z-]{1,64}$/.test(r.id)) errors.push("channel id is invalid");
  if (!CHANNEL_KINDS.includes(r.kind as ChannelKind)) errors.push("channel kind is invalid");
  const kind = r.kind as ChannelKind;
  const config: Record<string, string> = {};
  const rawConfig = (typeof r.config === "object" && r.config !== null ? r.config : {}) as Record<string, unknown>;
  for (const field of CHANNEL_FIELDS[kind] ?? []) {
    const value = typeof rawConfig[field.key] === "string" ? (rawConfig[field.key] as string).trim() : "";
    if (!value) {
      if (!field.optional) errors.push(`${field.key} is required`);
      continue;
    }
    if (value.length > 2000) errors.push(`${field.key} is too long`);
    if (field.url && !URL_RE.test(value)) errors.push(`${field.key} must be an http(s) URL`);
    config[field.key] = value;
  }
  const name = typeof r.name === "string" ? r.name.trim().slice(0, 80) : "";
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { id: r.id as string, kind, name, enabled: r.enabled !== false, config } };
}

export function validateNotificationSettings(raw: unknown): { ok: true; value: NotificationSettings } | { ok: false; errors: string[] } {
  if (typeof raw !== "object" || raw === null) return { ok: false, errors: ["notification settings must be an object"] };
  const r = raw as Record<string, unknown>;
  const errors: string[] = [];
  const channels: Channel[] = [];
  if (!Array.isArray(r.channels) || r.channels.length > 20) errors.push("channels must be a list of at most 20");
  else {
    for (const c of r.channels) {
      const v = validateChannel(c);
      if (v.ok) channels.push(v.value);
      else errors.push(...v.errors);
    }
  }
  const sender = typeof r.sender === "string" && /^(any|[0-9A-Za-z_-]{1,64})$/.test(r.sender) ? r.sender : null;
  if (!sender) errors.push("sender must be a device id or 'any'");
  const j = (typeof r.journal === "object" && r.journal !== null ? r.journal : {}) as Record<string, unknown>;
  const journal = {
    enabled: j.enabled === true,
    notebookId: typeof j.notebookId === "string" && /^[0-9a-z-]{1,40}$/.test(j.notebookId) ? j.notebookId : null,
  };
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { channels, sender: sender!, journal } };
}

export interface PushMessage {
  title: string;
  body: string;
  /** Optional link opened when the notification is tapped. */
  url?: string;
  /** Structured data for generic webhooks. */
  data?: Record<string, unknown>;
}

export interface ChannelRequest {
  url: string;
  method: "POST" | "GET";
  headers?: Record<string, string>;
  json?: unknown;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Builds the HTTP request that delivers `message` through `channel`. */
export function buildChannelRequest(channel: Channel, message: PushMessage): ChannelRequest {
  const c = channel.config;
  const text = message.body ? `${message.title}\n${message.body}` : message.title;
  switch (channel.kind) {
    case "bark":
      return {
        url: `${trimSlash(c.server || "https://api.day.app")}/push`,
        method: "POST",
        json: { device_key: c.key, title: message.title, body: message.body, group: "Still", ...(message.url ? { url: message.url } : {}) },
      };
    case "ntfy":
      return {
        url: trimSlash(c.server || "https://ntfy.sh"),
        method: "POST",
        headers: c.token ? { Authorization: `Bearer ${c.token}` } : undefined,
        json: { topic: c.topic, title: message.title, message: message.body || message.title, tags: ["bell"], ...(message.url ? { click: message.url } : {}) },
      };
    case "telegram":
      return {
        url: `https://api.telegram.org/bot${c.botToken}/sendMessage`,
        method: "POST",
        json: { chat_id: c.chatId, text, disable_web_page_preview: true },
      };
    case "serverchan": {
      const key = c.sendKey ?? "";
      // Server酱³ keys look like "sctp<uid>t…" and use a per-user host.
      const m = /^sctp(\d+)t/.exec(key);
      const url = m ? `https://${m[1]}.push.ft07.com/send/${key}.send` : `https://sctapi.ftqq.com/${key}.send`;
      return { url, method: "POST", json: { title: message.title, desp: message.body } };
    }
    case "wecom":
      return { url: c.webhook!, method: "POST", json: { msgtype: "text", text: { content: text } } };
    case "dingtalk":
      return { url: c.webhook!, method: "POST", json: { msgtype: "text", text: { content: text } } };
    case "feishu":
      return { url: c.webhook!, method: "POST", json: { msg_type: "text", content: { text } } };
    case "discord":
      return { url: c.webhook!, method: "POST", json: { username: "Still", content: text } };
    case "slack":
      return { url: c.webhook!, method: "POST", json: { text } };
    case "gotify":
      return {
        url: `${trimSlash(c.server!)}/message`,
        method: "POST",
        headers: { "X-Gotify-Key": c.token! },
        json: { title: message.title, message: message.body, priority: 5 },
      };
    case "webhook":
      return { url: c.url!, method: "POST", json: { source: "still", title: message.title, body: message.body, url: message.url, ...message.data } };
  }
}

/** Whether a response status means the provider accepted the message. */
export function isDelivered(status: number): boolean {
  return status >= 200 && status < 300;
}

const SYMBOLS: Record<string, string> = {
  USD: "$",
  CNY: "¥",
  EUR: "€",
  GBP: "£",
  JPY: "JP¥",
  HKD: "HK$",
  TWD: "NT$",
  KRW: "₩",
  INR: "₹",
  RUB: "₽",
  TRY: "₺",
  BRL: "R$",
  CAD: "CA$",
  AUD: "A$",
  SGD: "S$",
};

/** `Intl`-free money formatting for runtimes without it (goja). */
export function formatMoneyPlain(money: Money): string {
  const amount = formatMoneyAmount(money);
  const [int, frac] = amount.split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const number = frac ? `${grouped}.${frac}` : grouped;
  const symbol = SYMBOLS[money.currency];
  return symbol ? `${symbol}${number}` : `${money.currency} ${number}`;
}
