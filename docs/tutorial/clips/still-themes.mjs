// Still showcase: one click per theme; the whole UI follows, light and dark.
import { demoSubscriptions, openDock, openManager, resetStill, rpc } from "./_still.mjs";

export const meta = {
  id: "still-themes",
  title: "切换主题",
  host: "still",
  locales: ["zh-CN", "en-US"],
  i18n: {
    "zh-CN": { settings: "设置", themes: ["静谧", "卡片墙", "时间线", "票据"], dark: "深色" },
    "en-US": { settings: "Settings", themes: ["Calm", "Wallet", "Timeline", "Receipt"], dark: "Dark" },
  },
  viewport: { width: 1280, height: 720 },
  durationS: 12.0,
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
  await openDock(page);
  const manager = await openManager(page);
  await manager.getByRole("tab", { name: meta.i18n[locale].settings, exact: true }).click();
  await page.waitForTimeout(500);
  // Centre the light/dark switch: the theme cards sit just above it, and the
  // status bar would cover anything at the very bottom.
  await manager.getByRole("radio", { name: meta.i18n[locale].dark, exact: true }).evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(400);
  return {};
}

export async function actions(driver) {
  const { at, moveTo, jumpTo, click, pointWithin, page, strings } = driver;
  const manager = page.locator(".layout__center .still-panel").first();
  const card = (name) => manager.locator("button[aria-pressed]", { hasText: name }).first();
  const first = await pointWithin(card(strings.themes[0]), 0.5, 0.4);
  await jumpTo({ x: first.x - 120, y: first.y + 160 });

  // Start on Receipt (the default), visit the other three, come back.
  let t = 0.6;
  for (const name of strings.themes) {
    await at(t);
    await moveTo(await pointWithin(card(name), 0.5, 0.4), 480);
    await at(t + 0.75);
    await click();
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

export async function verify({ page }) {
  const settings = (await rpc(page, "snapshot")).settings;
  const ok = settings.appearance.theme === "receipt" && settings.appearance.mode === "dark";
  return { ok, operation: "still-themes", appearance: settings.appearance, reason: ok ? null : "theme not applied" };
}
