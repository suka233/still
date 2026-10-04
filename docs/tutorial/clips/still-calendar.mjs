// Still showcase: the manager's calendar and insights.
import { demoSubscriptions, openManager, resetStill, rpc } from "./_still.mjs";

export const meta = {
  id: "still-calendar",
  title: "日历与洞察",
  host: "still",
  locales: ["zh-CN", "en-US"],
  i18n: {
    "zh-CN": { calendar: "日历", insights: "洞察", next: "下个月" },
    "en-US": { calendar: "Calendar", insights: "Insights", next: "Next month" },
  },
  viewport: { width: 1280, height: 720 },
  durationS: 11.6,
  cursorStyle: "precision-dart",
  hide: [],
  camera: { presetId: "glide-focus", zoom: 1.35, lagS: 0.1 },
  output: {
    mp4: { width: 1280, height: 720, fps: 30 },
    webp: { width: 960, height: 540, fps: 15, maxBytes: 5 * 1024 * 1024 },
  },
};

export async function seed({ page, locale }) {
  await resetStill(page, { locale, subscriptions: demoSubscriptions(locale, { netflixDue: false }) });
  // Work in the manager only: close the dock so the tab gets the full width.
  const dock = page.locator(".sy__stillupcoming");
  if (await dock.isVisible()) await page.locator('.dock__item:has(use[*|href="#iconStill"])').first().click();
  const manager = await openManager(page);
  const tabs = manager.getByRole("tablist").first();
  await tabs.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector(".layout__center .layout-tab-container > div:not(.fn__none)")?.scrollBy({ top: -60 }));
  await page.waitForTimeout(400);
  return {};
}

export async function actions(driver) {
  const { at, moveTo, jumpTo, click, pointWithin, page, strings } = driver;
  const manager = page.locator(".layout__center .still-panel").first();
  const calTab = manager.getByRole("tab", { name: strings.calendar, exact: true });
  const p = await pointWithin(calTab, 0.85, 0.5);
  await jumpTo({ x: p.x + 160, y: p.y + 180 });

  await at(0.5);
  await moveTo(p, 500);
  await at(1.4);
  await click();
  await manager.locator("button.still\\:aspect-square").first().waitFor({ state: "visible" });

  // Pick a day that has charges.
  await at(2.3);
  const day = manager.locator("button.still\\:aspect-square:has(.still-avatar)").nth(1);
  await moveTo(await pointWithin(day, 0.85, 0.85), 620);
  await at(3.6);
  await click();

  // Next month
  await at(4.6);
  const next = manager.getByRole("button", { name: strings.next });
  await moveTo(await pointWithin(next, 0.6, 0.6), 560);
  await at(5.8);
  await click();

  // Insights
  await at(6.8);
  const insights = manager.getByRole("tab", { name: strings.insights, exact: true });
  await moveTo(await pointWithin(insights, 0.85, 0.5), 560);
  await at(8.0);
  await click();
  await at(8.8);
  await moveTo({ x: 900, y: 660 }, 600);
}

export async function verify({ page, strings }) {
  const active = await page.locator(".layout__center [role=tab][data-state=active]").first().textContent();
  const subs = (await rpc(page, "snapshot")).subscriptions.length;
  const ok = (active ?? "").includes(strings.insights) && subs > 0;
  return { ok, operation: "still-calendar", activeTab: active, reason: ok ? null : "insights tab not active" };
}
