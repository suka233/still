// Still (续了么) host for the make-kmind-tutorial-slice-lite pipeline.
//
// Targets a dev SiYuan kernel started by apps/siyuan/scripts/serve.mjs (browser
// mode, plugin "still" symlinked from dist/). The UI language is fixed when the
// kernel starts (STILL_LANG), so prepare() only checks it.
//
// setup-recorder.sh copies this file into a working copy of the pipeline as
// lib/hosts/still.mjs and registers it in lib/hosts/index.mjs.
import { existsSync } from "node:fs";
import { chromium } from "playwright";

export const id = "still";

export function defaultBaseUrl() {
  return process.env.STILL_TUTORIAL_BASE_URL ?? "http://127.0.0.1:6899";
}

/** Playwright's bundled Chromium when it's downloaded, otherwise the installed Google Chrome. */
export function launchOptions() {
  let bundled = false;
  try {
    bundled = existsSync(chromium.executablePath());
  } catch {}
  return bundled ? {} : { channel: "chrome" };
}

export function contextOptions({ locale }) {
  return { locale };
}

async function api(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, { method: "POST", body: JSON.stringify(body ?? {}) });
  const json = await response.json();
  if (json.code !== 0) throw new Error(`SiYuan API ${path}: ${json.msg ?? json.code}`);
  return json.data;
}

const primary = (value) => String(value ?? "").toLowerCase().split(/[-_]/)[0];

export async function prepare({ baseUrl, locale }) {
  await api(baseUrl, "/api/setting/setBazaar", { trust: true, petalDisabled: false });
  const conf = (await api(baseUrl, "/api/system/getConf", {})).conf;
  if (primary(conf.appearance.lang) !== primary(locale)) {
    throw new Error(`dev kernel UI language is ${conf.appearance.lang}; restart serve.mjs with STILL_LANG=${locale === "zh-CN" ? "zh-CN" : "en"}`);
  }
}

export async function open({ page, baseUrl }) {
  await page.goto(`${baseUrl}/stage/build/desktop/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitForStill(page);
  await dismissHostChrome(page);
}

export async function waitForStill(page) {
  await page.waitForFunction(() => (window.siyuan?.ws?.app?.plugins ?? []).some((p) => p.name === "still"), null, { timeout: 60_000 });
  await page.waitForTimeout(1500);
}

export async function dismissHostChrome(page) {
  await page.evaluate(() => {
    document.querySelector("button.onboarding__close")?.click();
    document.querySelector("section.onboarding")?.remove();
    document.querySelector(".onboarding-container")?.classList.remove("onboarding-container");
  });
}

export const cleanCaptureCss = `[class*="onboarding"]:not(.layout__center) { display: none !important; }`;

export const hideGroups = {
  "node-chrome": ``,
};

export const route = "/stage/build/desktop/";
