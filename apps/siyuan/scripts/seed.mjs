#!/usr/bin/env node
/**
 * Fills a running dev kernel (see serve.mjs) with realistic demo data, with
 * dates relative to today so reminders are always due.
 *
 *   node scripts/seed.mjs [--reset] [--lang en|zh]
 */
import { demoSettings, demoSubscriptions } from "../../../tools/demo-data.mjs";

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

const demo = demoSubscriptions(lang);

if (reset) {
  const res = await fetch(`${base}/api/file/removeFile`, { method: "POST", body: JSON.stringify({ path: "/data/storage/petal/still" }) });
  const json = await res.json();
  if (json.code !== 0 && !/not exist/i.test(json.msg)) throw new Error(`reset: ${json.msg}`);
  // Give the kernel's watcher a moment so the removal isn't mistaken for later writes.
  await new Promise((r) => setTimeout(r, 500));
}

await rpc("updateSettings", demoSettings(lang));
for (const sub of demo) {
  await rpc("createSubscription", sub, { settle: false });
}
await rpc("refreshRates").catch((e) => console.warn(`[still] rates: ${e.message}`));
const snapshot = await rpc("snapshot");
console.log(`[still] seeded ${snapshot.subscriptions.length} subscriptions (${lang})`);
