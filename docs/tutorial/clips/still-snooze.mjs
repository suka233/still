// Still tutorial: not sure yet? "Decide later" asks again on a day you pick.
import { demoSubscriptions, openDock, resetStill, rpc } from "./_still.mjs";

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
  durationS: 9.4,
  cursorStyle: "precision-dart",
  hide: [],
  camera: { presetId: "glide-focus", zoom: 1.6, lagS: 0.1 },
  seedSettleMs: 1500,
  output: {
    mp4: { width: 1280, height: 720, fps: 30 },
    webp: { width: 960, height: 540, fps: 15, maxBytes: 5 * 1024 * 1024 },
  },
};

export async function seed({ page, locale }) {
  await resetStill(page, { locale, subscriptions: demoSubscriptions(locale), claim: false });
  await openDock(page);
  await page.locator("[role=dialog]").waitFor({ state: "visible", timeout: 15_000 });
  return {};
}

export async function actions(driver) {
  const { at, moveTo, jumpTo, click, pointWithin, page, strings } = driver;
  const dialog = page.locator("[role=dialog]");
  const later = dialog.getByRole("button", { name: strings.later });
  const target = await pointWithin(later, 0.85, 0.55);
  await jumpTo({ x: target.x - 60, y: target.y + 210 });

  await at(0.8);
  await moveTo(target, 600);
  await at(1.9);
  await click();
  const option = page.locator("[data-slot=popover-content] button", { hasText: strings.option }).first();
  await option.waitFor({ state: "visible" });

  // Popovers need a long settle so the camera arrives while it's open.
  await at(2.5);
  await moveTo(await pointWithin(option, 0.9, 0.5), 520);
  await at(4.1);
  await click();
  await page.locator("[data-sonner-toaster] li").first().waitFor({ state: "visible" });

  await at(4.9);
  const toast = page.locator("[data-sonner-toaster] li").first();
  await moveTo(await pointWithin(toast, 0.35, 1.6), 640);
}

export async function verify({ page, strings }) {
  const snapshot = await rpc(page, "snapshot");
  const sub = snapshot.subscriptions.find((s) => s.name === strings.name);
  const decision = snapshot.decisions.find((d) => d.subscriptionId === sub?.id);
  const ok = decision?.choice === "snooze" && Boolean(decision.snoozeUntil) && sub?.status === "active";
  return { ok, operation: "still-snooze", decision: decision ?? null, reason: ok ? null : "no snooze recorded" };
}
