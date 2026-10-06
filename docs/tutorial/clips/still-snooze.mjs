// Still tutorial: not sure yet? "Decide later" asks again on a day you pick.
import { demoSubscriptions, enterDock, resetStill, rpc } from "./_still.mjs";

export const meta = {
  id: "still-snooze",
  title: "再想想：换个时间再问",
  host: "still",
  locales: ["zh-CN", "en-US"],
  i18n: {
    "zh-CN": { later: "再想想", option: "明天", name: "Netflix" },
    "en-US": { later: "Decide later", option: "Tomorrow", name: "Netflix" },
  },
  viewport: { width: 1280, height: 720 },
  durationS: 12.2,
  cursorStyle: "precision-dart",
  hide: [],
  // Keep the card, popover and dock feedback visible at the same time.
  camera: null,
  seedSettleMs: 1500,
  output: {
    mp4: { width: 1280, height: 720, fps: 30 },
    webp: { width: 960, height: 540, fps: 15, maxBytes: 5 * 1024 * 1024 },
  },
};

export async function seed({ page, locale }) {
  await resetStill(page, { locale, subscriptions: demoSubscriptions(locale) });
  return {};
}

export async function actions(driver) {
  const { at, moveTo, click, pointWithin, page, strings } = driver;
  const dock = await enterDock(driver);
  await moveTo(await pointWithin(dock.locator(".stl-pending-head"), 0.7, 0.5), 320);
  await at(2.4);
  await click();
  const dialog = page.locator("[role=dialog]");
  await dialog.waitFor({ state: "visible" });
  const later = dialog.getByRole("button", { name: strings.later });
  const target = await pointWithin(later, 0.85, 0.55);

  await at(3.2);
  await moveTo(target, 420);
  await at(4.4);
  await click();
  const option = page.locator("[data-slot=popover-content] button", { hasText: strings.option }).first();
  await option.waitFor({ state: "visible" });

  // Leave time to read the snooze choices before selecting tomorrow.
  await at(5.0);
  await moveTo(await pointWithin(option, 0.9, 0.5), 320);
  await at(6.8);
  await click();
  await page.locator("[data-sonner-toaster] li").first().waitFor({ state: "visible" });

  // Keep the later stamp and exit in frame before looking at the result.
  await at(8.2);
  await moveTo({ x: 860, y: 610 }, 420);
}

export async function verify({ page, strings }) {
  const snapshot = await rpc(page, "snapshot");
  const sub = snapshot.subscriptions.find((s) => s.name === strings.name);
  const decision = snapshot.decisions.find((d) => d.subscriptionId === sub?.id);
  const ok = decision?.choice === "snooze" && Boolean(decision.snoozeUntil) && sub?.status === "active";
  return { ok, operation: "still-snooze", decision: decision ?? null, reason: ok ? null : "no snooze recorded" };
}
