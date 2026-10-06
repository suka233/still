// Shared seeding helpers for Still tutorial clips (recorded with the
// make-kmind-tutorial-slice-lite pipeline against the dev kernel from
// apps/siyuan/scripts/serve.mjs). Seeding only prepares data; every
// demonstrated action is real mouse/keyboard input.

export async function api(page, path, body) {
  return page.evaluate(
    async ({ path, body }) => {
      const res = await fetch(path, { method: "POST", body: JSON.stringify(body ?? {}) });
      const json = await res.json();
      if (json.code !== 0) throw new Error(`SiYuan API ${path}: ${json.msg}`);
      return json.data;
    },
    { path, body },
  );
}

export async function rpc(page, method, ...params) {
  return page.evaluate(
    async ({ method, params }) => {
      const res = await fetch("/api/plugin/rpc?name=still", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const json = await res.json();
      if (json.error) throw new Error(`${method}: ${json.error.data ?? json.error.message}`);
      return json.result;
    },
    { method, params },
  );
}

const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** A date `daysAhead` from today, pushed `monthsAgo` into the past on the same cycle. */
export function anchor(daysAhead, monthsAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setMonth(d.getMonth() - monthsAgo);
  return fmt(d);
}

const monthly = { unit: "month", every: 1 };
const yearly = { unit: "year", every: 1 };

/** Demo data; `due` decides which charges are inside a reminder window. */
export function demoSubscriptions(locale, { netflixDue = true, includeSpotify = true, trial = false } = {}) {
  const zh = locale.startsWith("zh");
  return [
    trial && { name: "ChatGPT Plus", icon: "service:chatgpt", price: { amount: 2000, currency: "USD" }, cycle: monthly, anchorDate: anchor(1), trialEndsOn: anchor(1), category: "ai", cancelUrl: "https://chatgpt.com/#settings/Subscription" },
    { name: "Netflix", icon: "service:netflix", price: { amount: 1549, currency: "USD" }, cycle: monthly, anchorDate: anchor(netflixDue ? 2 : 9, 14), category: "video", cancelUrl: "https://www.netflix.com/cancelplan", note: zh ? "和家人共用，标准版" : "Shared with family, Standard plan" },
    includeSpotify && { name: "Spotify Premium", icon: "service:spotify", price: { amount: 1199, currency: "USD" }, cycle: monthly, anchorDate: anchor(6, 30), category: "music" },
    { name: "iCloud+", icon: "service:icloud", price: { amount: zh ? 2100 : 299, currency: zh ? "CNY" : "USD" }, cycle: monthly, anchorDate: anchor(12, 26), category: "storage" },
    { name: zh ? "B 站大会员" : "YouTube Premium", icon: zh ? "service:bilibili" : "service:youtube-premium", price: zh ? { amount: 14800, currency: "CNY" } : { amount: 1399, currency: "USD" }, cycle: zh ? yearly : monthly, anchorDate: anchor(zh ? 40 : 20, 12), category: "video" },
    { name: "GitHub Copilot", icon: "service:github-copilot", price: { amount: 1000, currency: "USD" }, cycle: monthly, anchorDate: anchor(18, 9), category: "dev" },
    { name: "Notion Plus", icon: "service:notion", price: { amount: 9600, currency: "USD" }, cycle: yearly, anchorDate: anchor(95, 24), category: "productivity" },
    { name: zh ? "域名 still.app" : "still.app domain", icon: "🌐", price: { amount: 1400, currency: "USD" }, cycle: yearly, anchorDate: anchor(150, 36), category: "hosting" },
  ].filter(Boolean);
}

async function closeAllTabs(page) {
  for (let i = 0; i < 12; i++) {
    const close = page.locator(".layout__center .layout-tab-bar .item__close").first();
    if (!(await close.count())) return;
    await close.click({ force: true });
    await page.waitForTimeout(150);
  }
}

export async function reloadStill(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window.siyuan?.ws?.app?.plugins ?? []).some((p) => p.name === "still"), null, { timeout: 60_000 });
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    document.querySelector("button.onboarding__close")?.click();
    document.querySelector("section.onboarding")?.remove();
    document.querySelector(".onboarding-container")?.classList.remove("onboarding-container");
  });
}

/**
 * Wipes Still's data and seeds a clean demo state, then reloads.
 * `claim: true` marks due reminders as already shown so no card pops up.
 */
export async function resetStill(page, { locale, subscriptions, claim = true, appearance = { theme: "thermal", mode: "light", accent: null } }) {
  // Keep rates.json: refetching on every reset is slow and occasionally fails.
  for (const part of ["subscriptions", "decisions", "delivered", "settings.json", "notifications.json"]) {
    await api(page, "/api/file/removeFile", { path: `/data/storage/petal/still/${part}` }).catch(() => undefined);
  }
  await page.waitForTimeout(600);
  await rpc(page, "updateSettings", {
    notifyAt: "00:00",
    defaultCurrency: locale.startsWith("zh") ? "CNY" : "USD",
    convertCurrency: true,
    remindDaysBefore: [3, 1],
    trialRemindDaysBefore: [3, 1],
    appearance,
  });
  const created = [];
  for (const s of subscriptions) created.push(await rpc(page, "createSubscription", { status: "active", ...s }, { settle: false }));
  await rpc(page, "refreshRates").catch(() => undefined);
  if (claim) {
    const due = await rpc(page, "pendingReminders");
    if (due.length) await rpc(page, "claimReminders", due.map((r) => r.key));
  } else {
    // The page we're about to reload may already have claimed (shown) them; forget that.
    await page.waitForTimeout(1200);
    await api(page, "/api/file/removeFile", { path: "/data/storage/petal/still/delivered" }).catch(() => undefined);
  }
  await closeAllTabs(page);
  // Reload with the dock closed, so its first entrance can be captured by actions.
  if (await page.locator(".sy__stillupcoming").isVisible()) {
    await page.locator('.dock__item:has(use[*|href="#iconStill"])').first().dispatchEvent("click");
  }
  await reloadStill(page);
  // Host hover labels can cover the dock while its first-open animation prints.
  await page.addStyleTag({ content: '.tooltip, #tooltip, [role="tooltip"] { visibility: hidden !important; }' });
  return created;
}

/** Makes sure the Still dock panel is open and pinned (not the hover-only float). */
export async function openDock(page) {
  const panel = page.locator(".sy__stillupcoming");
  if (!(await panel.isVisible())) {
    // Preparation may run while the reminder dialog covers the host chrome.
    await page.locator('.dock__item:has(use[*|href="#iconStill"])').first().dispatchEvent("click");
    await page.waitForTimeout(600);
  }
  await panel.waitFor({ state: "visible" });
  return panel;
}

/** Open the dock with real input after the recording timeline has started. */
export async function enterDock(driver) {
  const { at, jumpTo, moveTo, click, pointWithin, page } = driver;
  const icon = page.locator('.dock__item:has(use[*|href="#iconStill"])').first();
  const target = await pointWithin(icon, 0.5, 0.5);
  await jumpTo({ x: target.x - 90, y: target.y + 100 });
  await at(0.1);
  await moveTo(target, 240);
  await at(0.7);
  await click();
  const dock = page.locator(".sy__stillupcoming");
  await dock.waitFor({ state: "visible" });
  await dock.locator(".stl-dock[data-enter]").waitFor({ state: "attached" });
  await at(1.5);
  return dock;
}

export async function openManager(page) {
  await page.evaluate(() => [...document.querySelectorAll("#toolbar .toolbar__item")].find((e) => e.querySelector('use[*|href="#iconStill"]'))?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  const manager = page.locator(".layout__center .still-panel").first();
  await manager.waitFor({ state: "visible" });
  await page.waitForTimeout(600);
  return manager;
}
