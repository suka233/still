#!/usr/bin/env node
/**
 * Visual QA helper: opens the dev SiYuan (see apps/siyuan/scripts/serve.mjs),
 * runs optional setup steps and saves screenshots at 2x.
 *
 *   node tools/snap/snap.mjs <out-dir> [--mobile] [--dark] [--steps steps.mjs]
 *
 * A steps module exports `default async (page, shot) => {}`; `shot(name, selector?)`
 * saves `<out-dir>/<name>.png`, clipped to the selector when given.
 */
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const out = resolve(args[0] ?? "snaps");
const mobile = args.includes("--mobile");
const dark = args.includes("--dark");
const stepsPath = args.includes("--steps") ? args[args.indexOf("--steps") + 1] : null;
const base = `http://127.0.0.1:${process.env.STILL_PORT ?? "6899"}`;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: dark ? "dark" : "light",
  isMobile: mobile,
  hasTouch: mobile,
  locale: process.env.STILL_LOCALE ?? "zh-CN",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(`${base}/stage/build/${mobile ? "mobile" : "desktop"}/`);
await page.waitForSelector(mobile ? "#editor, .protyle" : ".layout__center", { timeout: 30_000 });
await page.waitForTimeout(1500);
// Dismiss SiYuan's first-run welcome card if present.
await page.evaluate(() => document.querySelector(".b3-snackbar__close, .block__icon[data-type=close]")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

async function shot(name, selector) {
  const target = selector ? page.locator(selector).first() : page;
  await target.screenshot({ path: join(out, `${name}.png`), animations: "disabled" });
  console.log(join(out, `${name}.png`));
}

if (stepsPath) {
  const steps = (await import(pathToFileURL(resolve(stepsPath)).href)).default;
  await steps(page, shot);
} else {
  await shot("page");
}

if (errors.length) console.log("page errors:\n" + errors.join("\n"));
await browser.close();
