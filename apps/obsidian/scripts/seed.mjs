#!/usr/bin/env node
/**
 * Fills the Still plugin in a running Obsidian with demo data, over the
 * DevTools protocol. Start Obsidian with --remote-debugging-port first.
 *
 *   node scripts/seed.mjs [--reset] [--lang en|zh] [--port 9333]
 */
import { demoSettings, demoSubscriptions } from "../../../tools/demo-data.mjs";

const arg = (name, fallback) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback);
const port = arg("--port", "9333");
const lang = arg("--lang", "zh");
const reset = process.argv.includes("--reset");

/** Evaluates an async expression in Obsidian's main window and returns its JSON value. */
async function evaluate(expression) {
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = pages.find((p) => p.type === "page" && p.url.startsWith("app://"));
  if (!page) throw new Error(`no Obsidian window on port ${port}`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  const reply = await new Promise((resolve) => {
    ws.onmessage = (e) => resolve(JSON.parse(e.data));
    ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
  });
  ws.close();
  if (reply.result?.exceptionDetails) throw new Error(reply.result.exceptionDetails.exception?.description ?? "evaluation failed");
  return reply.result?.result?.value;
}

const payload = JSON.stringify({ reset, settings: demoSettings(lang), subscriptions: demoSubscriptions(lang) });
const count = await evaluate(`(async () => {
  const { reset, settings, subscriptions } = ${payload};
  const plugin = app.plugins.plugins.still;
  if (!plugin) throw new Error("Still isn't enabled in this vault");
  if (reset) {
    const folder = plugin.data.folder;
    if (await app.vault.adapter.exists(folder)) await app.vault.adapter.rmdir(folder, true);
  }
  await plugin.engine.updateSettings(settings);
  for (const sub of subscriptions) await plugin.engine.createSubscription(sub, { settle: false });
  await plugin.engine.refreshRates(true).catch(() => null);
  await plugin.engine.externalChange();
  return (await plugin.engine.snapshot()).subscriptions.length;
})()`);
console.log(`[still] seeded ${count} subscriptions (${lang})`);
