#!/usr/bin/env node
/**
 * Fills a running dev kernel (see serve.mjs) with realistic demo data, with
 * dates relative to today so reminders are always due.
 *
 *   node scripts/seed.mjs [--reset] [--lang en|zh]
 */
const port = process.env.STILL_PORT ?? "6899";
const base = `http://127.0.0.1:${port}`;
const reset = process.argv.includes("--reset");
const lang = process.argv.includes("--lang") ? process.argv[process.argv.indexOf("--lang") + 1] : "zh";

async function rpc(method, ...params) {
  const res = await fetch(`${base}/api/plugin/rpc?name=still`, {
    method: "POST",
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.data ?? json.error.message}`);
  return json.result;
}

function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Anchor in the past so the next charge lands `daysAhead` from today. */
function monthlyAnchor(daysAhead, monthsAgo) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setMonth(d.getMonth() - monthsAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const zh = lang === "zh";
const monthly = { unit: "month", every: 1 };
const yearly = { unit: "year", every: 1 };

const demo = [
  { name: "ChatGPT Plus", icon: "service:chatgpt", price: { amount: 2000, currency: "USD" }, cycle: monthly, anchorDate: day(1), trialEndsOn: day(1), category: "ai", cancelUrl: "https://chatgpt.com/#settings/Subscription" },
  { name: "Netflix", icon: "service:netflix", price: { amount: 1549, currency: "USD" }, cycle: monthly, anchorDate: monthlyAnchor(2, 14), category: "video", cancelUrl: "https://www.netflix.com/cancelplan", note: zh ? "和家人共用，标准版" : "Shared with family, Standard plan" },
  { name: "Spotify Premium", icon: "service:spotify", price: { amount: 1199, currency: "USD" }, cycle: monthly, anchorDate: monthlyAnchor(5, 30), category: "music", cancelUrl: "https://www.spotify.com/account/subscription/" },
  { name: "iCloud+", icon: "service:icloud", price: { amount: 2100, currency: "CNY" }, cycle: monthly, anchorDate: monthlyAnchor(12, 26), category: "storage" },
  { name: zh ? "B 站大会员" : "Bilibili Premium", icon: "service:bilibili", price: { amount: 14800, currency: "CNY" }, cycle: yearly, anchorDate: monthlyAnchor(40, 12), category: "video" },
  { name: "GitHub Copilot", icon: "service:github-copilot", price: { amount: 1000, currency: "USD" }, cycle: monthly, anchorDate: monthlyAnchor(18, 9), category: "dev" },
  { name: "Notion Plus", icon: "service:notion", price: { amount: 9600, currency: "USD" }, cycle: yearly, anchorDate: monthlyAnchor(95, 24), category: "productivity" },
  { name: zh ? "域名 still.app" : "Domain still.app", icon: "🌐", price: { amount: 1400, currency: "USD" }, cycle: yearly, anchorDate: monthlyAnchor(150, 36), category: "dev" },
  { name: zh ? "健身房月卡" : "Gym membership", icon: "🏋️", price: { amount: 29900, currency: "CNY" }, cycle: monthly, anchorDate: monthlyAnchor(8, 4), status: "paused", category: "fitness" },
];

if (reset) {
  const res = await fetch(`${base}/api/file/removeFile`, { method: "POST", body: JSON.stringify({ path: "/data/storage/petal/still" }) });
  const json = await res.json();
  if (json.code !== 0 && !/not exist/i.test(json.msg)) throw new Error(`reset: ${json.msg}`);
  // Give the kernel's watcher a moment so the removal isn't mistaken for later writes.
  await new Promise((r) => setTimeout(r, 500));
}

await rpc("updateSettings", { notifyAt: "00:00", defaultCurrency: zh ? "CNY" : "USD", remindDaysBefore: [3, 1], trialRemindDaysBefore: [3, 1] });
for (const sub of demo) {
  await rpc("createSubscription", { status: "active", ...sub });
}
await rpc("refreshRates").catch((e) => console.warn(`[still] rates: ${e.message}`));
const snapshot = await rpc("snapshot");
console.log(`[still] seeded ${snapshot.subscriptions.length} subscriptions (${lang})`);
