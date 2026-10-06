// Still tutorial: the "still using it?" card — decide not to renew, with
// one-click undo and a shortcut to the provider's cancellation page.
import { demoSubscriptions, enterDock, resetStill, rpc } from "./_still.mjs";

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
  durationS: 10.0,
  cursorStyle: "precision-dart",
  hide: [],
  // Card and dock respond together; the full viewport keeps both in frame.
  camera: null,
  seedSettleMs: 1500,
  output: {
    mp4: { width: 1280, height: 720, fps: 30 },
    webp: { width: 960, height: 540, fps: 15, maxBytes: 5 * 1024 * 1024 },
  },
};

export async function seed({ page, locale }) {
  // Prepare the pending charge; open its card with real input in the recording.
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
  const cancel = dialog.getByRole("button", { name: strings.cancel });
  const target = await pointWithin(cancel, 0.82, 0.55);

  // Read the card for a beat, then decide.
  await at(3.4);
  await moveTo(target, 420);
  await at(4.6);
  await click();
  await page.locator("[data-sonner-toaster] li").first().waitFor({ state: "visible" });

  // Hold the stamp, tear and row collapse, then rest off the dock and toast.
  await at(6.2);
  await moveTo({ x: 860, y: 610 }, 420);
}

export async function verify({ page, strings }) {
  const snapshot = await rpc(page, "snapshot");
  const sub = snapshot.subscriptions.find((s) => s.name === strings.name);
  const decision = snapshot.decisions.find((d) => d.subscriptionId === sub?.id);
  const ok = sub?.status === "cancelled" && decision?.choice === "cancel";
  return { ok, operation: "still-decide-cancel", status: sub?.status ?? null, decision: decision?.choice ?? null, reason: ok ? null : "Netflix was not cancelled" };
}
