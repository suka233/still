import { describe, expect, it } from "vitest";
import { buildChannelRequest, formatMoneyPlain, validateChannel, validateNotificationSettings, type Channel } from "../src/index.js";

const msg = { title: "Netflix renews tomorrow", body: "$15.49 · Still using it?", url: "https://netflix.com" };
const ch = (kind: Channel["kind"], config: Record<string, string>): Channel => ({ id: "c1", kind, name: "", enabled: true, config });

describe("channel requests", () => {
  it("builds provider-specific payloads", () => {
    expect(buildChannelRequest(ch("bark", { key: "K" }), msg)).toMatchObject({ url: "https://api.day.app/push", json: { device_key: "K", url: msg.url } });
    expect(buildChannelRequest(ch("bark", { key: "K", server: "https://bark.me/" }), msg).url).toBe("https://bark.me/push");
    expect(buildChannelRequest(ch("ntfy", { topic: "t", token: "x" }), msg)).toMatchObject({ url: "https://ntfy.sh", headers: { Authorization: "Bearer x" }, json: { topic: "t", click: msg.url } });
    expect(buildChannelRequest(ch("telegram", { botToken: "B", chatId: "42" }), msg)).toMatchObject({ url: "https://api.telegram.org/botB/sendMessage", json: { chat_id: "42", text: `${msg.title}\n${msg.body}` } });
    expect(buildChannelRequest(ch("serverchan", { sendKey: "SCT123" }), msg).url).toBe("https://sctapi.ftqq.com/SCT123.send");
    expect(buildChannelRequest(ch("serverchan", { sendKey: "sctp987tABC" }), msg).url).toBe("https://987.push.ft07.com/send/sctp987tABC.send");
    expect(buildChannelRequest(ch("wecom", { webhook: "https://q/x" }), msg).json).toEqual({ msgtype: "text", text: { content: `${msg.title}\n${msg.body}` } });
    expect(buildChannelRequest(ch("feishu", { webhook: "https://f/x" }), msg).json).toMatchObject({ msg_type: "text" });
    expect(buildChannelRequest(ch("gotify", { server: "https://g/", token: "T" }), msg)).toMatchObject({ url: "https://g/message", headers: { "X-Gotify-Key": "T" } });
    expect(buildChannelRequest(ch("webhook", { url: "https://w" }), { ...msg, data: { daysLeft: 1 } }).json).toMatchObject({ source: "still", daysLeft: 1 });
  });
});

describe("channel validation", () => {
  it("requires fields and URLs", () => {
    expect(validateChannel({ id: "a", kind: "telegram", config: { botToken: "x" } }).ok).toBe(false);
    expect(validateChannel({ id: "a", kind: "slack", config: { webhook: "not a url" } }).ok).toBe(false);
    const ok = validateChannel({ id: "a", kind: "ntfy", name: " Phone ", config: { topic: " t ", junk: "x" } });
    expect(ok.ok && ok.value).toEqual({ id: "a", kind: "ntfy", name: "Phone", enabled: true, config: { topic: "t" } });
  });

  it("validates the whole notification settings", () => {
    expect(validateNotificationSettings({ channels: [], sender: "any", journal: { enabled: true, notebookId: "20250101-abc" } }).ok).toBe(true);
    expect(validateNotificationSettings({ channels: [], sender: "../x" }).ok).toBe(false);
  });
});

describe("plain money formatting", () => {
  it("formats without Intl", () => {
    expect(formatMoneyPlain({ amount: 1549, currency: "USD" })).toBe("$15.49");
    expect(formatMoneyPlain({ amount: 1234567, currency: "CNY" })).toBe("¥12,345.67");
    expect(formatMoneyPlain({ amount: 1500, currency: "JPY" })).toBe("JP¥1,500");
    expect(formatMoneyPlain({ amount: 990, currency: "CHF" })).toBe("CHF 9.90");
  });
});
