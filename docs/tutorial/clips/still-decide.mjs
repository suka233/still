// Still tutorial: the "still using it?" card — decide not to renew, with
// one-click undo and a shortcut to the provider's cancellation page.
import { demoSubscriptions, openDock, resetStill, rpc } from "./_still.mjs";

export const meta = {
  id: "still-decide",
  title: "续费前，先问问你",
  host: "still",
  locales: ["zh-CN", "en-US"],
  i18n: {
    "zh-CN": { cancel: "不续了", name: "Netflix", undo: "撤销" },
    "en-US": { cancel: "Cancel it", name: "Netflix", undo: "Undo" },
  },
  viewport: { width: 1280, height: 720 },
  durationS: 8.6,
  cursorStyle: "precision-dart",
  hide: [],
  camera: { presetId: "glide-focus", zoom: 1.5, lagS: 0.1 },
  seedSettleMs: 1500,
  output: {
    mp4: { width: 1280, height: 720, fps: 30 },
    webp: { width: 960, height: 540, fps: 15, maxBytes: 5 * 1024 * 1024 },
  },
};

export async function seed({ page, locale }) {
  // Netflix renews in 2 days and hasn't been shown yet, so the card pops up on load.
  await resetStill(page, { locale, subscriptions: demoSubscriptions(locale), claim: false });
  await openDock(page);
  await page.locator("[role=dialog]").waitFor({ state: "visible", timeout: 15_000 });
  return {};
}

export async function actions(driver) {
  const { at, moveTo, jumpTo, click, pointWithin, page, strings } = driver;
  const dialog = page.locator("[role=dialog]");
  const cancel = dialog.getByRole("button", { name: strings.cancel });
  const target = await pointWithin(cancel, 0.82, 0.55);
  await jumpTo({ x: target.x + 40, y: target.y + 200 });

  // Read the card for a beat, then decide.
  await at(0.9);
  await moveTo(target, 620);
  await at(2.4);
  await click();
  await page.locator("[data-sonner-toaster] li").first().waitFor({ state: "visible" });

  // Rest near the toast: Undo and "Cancel now" are right there.
  await at(3.2);
  const toast = page.locator("[data-sonner-toaster] li").first();
  await moveTo(await pointWithin(toast, 0.35, 1.6), 640);
}

export async function verify({ page, strings }) {
  const snapshot = await rpc(page, "snapshot");
  const sub = snapshot.subscriptions.find((s) => s.name === strings.name);
  const decision = snapshot.decisions.find((d) => d.subscriptionId === sub?.id);
  const ok = sub?.status === "cancelled" && decision?.choice === "cancel";
  return { ok, operation: "still-decide-cancel", status: sub?.status ?? null, decision: decision?.choice ?? null, reason: ok ? null : "Netflix was not cancelled" };
}
