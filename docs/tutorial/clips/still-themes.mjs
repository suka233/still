// Still showcase: one click per theme; the whole UI follows, light and dark.
import { demoSubscriptions, enterDock, openManager, resetStill, rpc } from "./_still.mjs";

export const meta = {
  id: "still-themes",
  title: "切换主题",
  host: "still",
  locales: ["zh-CN", "en-US"],
  i18n: {
    "zh-CN": { settings: "设置", themes: ["精品店", "票根", "孔版印刷", "极简", "热敏"], dark: "深色" },
    "en-US": { settings: "Settings", themes: ["Boutique", "Ticket", "Riso", "Swiss", "Thermal"], dark: "Dark" },
  },
  viewport: { width: 1280, height: 720 },
  durationS: 16.8,
  cursorStyle: "device-mouse",
  hide: [],
  camera: null,
  output: {
    mp4: { width: 1280, height: 720, fps: 30 },
    webp: { width: 960, height: 540, fps: 15, maxBytes: 5 * 1024 * 1024 },
  },
};

export async function seed({ page, locale }) {
  await resetStill(page, { locale, subscriptions: demoSubscriptions(locale, { netflixDue: false }) });
  const manager = await openManager(page);
  await manager.getByRole("tab", { name: meta.i18n[locale].settings, exact: true }).click();
  await page.waitForTimeout(500);
  // Align the grid's top; centring the mode switch would hide the first row.
  await manager.locator("button[aria-pressed]", { hasText: meta.i18n[locale].themes[0] }).first().evaluate((el) => el.parentElement.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(400);
  return { visits: [] };
}

export async function actions(driver, seeded) {
  const { at, moveTo, click, pointWithin, page, strings } = driver;
  const manager = page.locator(".layout__center .still-panel").first();
  await enterDock(driver);
  const card = (name) => manager.locator("button[aria-pressed]", { hasText: name }).first();
  // Opening the dock changes the manager width; align the grid again.
  await card(strings.themes[0]).evaluate((el) => el.parentElement.scrollIntoView({ block: "start" }));

  // Start on Thermal (the default), visit the other paper themes, come back.
  let t = 2.0;
  const expected = ["boutique", "ticket", "riso", "swiss", "thermal"];
  for (const [index, name] of strings.themes.entries()) {
    await at(t);
    await moveTo(await pointWithin(card(name), 0.5, 0.4), 480);
    await at(t + 0.75);
    await click();
    await page.waitForFunction(({ name }) => [...document.querySelectorAll('.layout__center button[aria-pressed="true"]')].some((el) => el.textContent.includes(name)), { name });
    const appearance = (await rpc(page, "snapshot")).settings.appearance;
    seeded.visits.push({ expected: expected[index], actual: appearance.theme });
    t += 2.2;
  }
  // Finish in dark mode.
  await at(t - 0.4);
  const dark = manager.getByRole("radio", { name: strings.dark, exact: true });
  await moveTo(await pointWithin(dark, 0.6, 0.5), 480);
  await at(t + 0.6);
  await click();
  await at(t + 1.3);
  await moveTo({ x: 640, y: 690 }, 520);
}

export async function verify({ page }, seeded) {
  const settings = (await rpc(page, "snapshot")).settings;
  const ok = seeded.visits.length === 5 && seeded.visits.every((v) => v.actual === v.expected) && settings.appearance.theme === "thermal" && settings.appearance.mode === "dark";
  return { ok, operation: "still-themes", visits: seeded.visits, appearance: settings.appearance, reason: ok ? null : "theme not applied" };
}
