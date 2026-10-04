// Still tutorial: add a subscription from the dock — search the catalog,
// pick a service, type the price, save.
import { demoSubscriptions, openDock, resetStill, rpc } from "./_still.mjs";

export const meta = {
  id: "still-add-subscription",
  title: "添加一个订阅",
  host: "still",
  locales: ["zh-CN", "en-US"],
  i18n: {
    "zh-CN": { add: "添加", query: "spot", service: "Spotify Premium", price: "11.99", save: "保存" },
    "en-US": { add: "Add", query: "spot", service: "Spotify Premium", price: "11.99", save: "Save" },
  },
  viewport: { width: 1280, height: 720 },
  durationS: 11.4,
  cursorStyle: "precision-dart",
  hide: [],
  camera: { presetId: "glide-focus", zoom: 1.6, lagS: 0.1 },
  output: {
    mp4: { width: 1280, height: 720, fps: 30 },
    webp: { width: 960, height: 540, fps: 15, maxBytes: 5 * 1024 * 1024 },
  },
};

export async function seed({ page, locale }) {
  await resetStill(page, { locale, subscriptions: demoSubscriptions(locale, { includeSpotify: false, netflixDue: false }) });
  await openDock(page);
  return {};
}

export async function actions(driver) {
  const { at, moveTo, jumpTo, click, typeText, centerOf, pointWithin, page, strings } = driver;
  const dock = page.locator(".sy__stillupcoming");
  const addButton = dock.getByRole("button", { name: strings.add, exact: true });
  const addPoint = await pointWithin(addButton, 0.8, 0.55);
  await jumpTo({ x: addPoint.x - 280, y: addPoint.y + 260 });

  // ① Add
  await at(0.4);
  await moveTo(addPoint, 520);
  await at(1.4);
  await click();
  await page.waitForSelector("[role=dialog] input", { state: "visible" });

  // ② Search the catalog
  await at(2.0);
  await typeText(strings.query);
  const tile = page.locator("[role=dialog] button", { hasText: strings.service }).first();
  await tile.waitFor({ state: "visible" });

  // ③ Pick the service
  await at(3.2);
  await moveTo(await pointWithin(tile, 0.5, 0.35), 520);
  await at(4.4);
  await click();
  await page.waitForSelector("[role=dialog] input[inputmode=decimal]", { state: "visible" });

  // ④ Price (the field is already focused); move the pointer off the text first
  await at(5.0);
  const price = page.locator("[role=dialog] input[inputmode=decimal]");
  await moveTo(await pointWithin(price, 0.9, 0.5), 420);
  await at(5.6);
  await typeText(strings.price);

  // ⑤ Save
  await at(6.8);
  const save = page.locator("[role=dialog] button[type=submit]");
  await moveTo(await pointWithin(save, 0.7, 0.55), 520);
  await at(7.9);
  await click();
  await dock.locator("li", { hasText: strings.service }).first().waitFor({ state: "visible" });

  // Rest beside the new row (measured after the list settles) so the result is in frame.
  await page.waitForTimeout(500);
  await at(8.6);
  const badge = dock.locator("ul li", { hasText: strings.service }).first().locator("[data-slot=badge]");
  await moveTo(await pointWithin(badge, 0.5, 1.9), 560);
}

export async function verify({ page, strings }) {
  const snapshot = await rpc(page, "snapshot");
  const sub = snapshot.subscriptions.find((s) => s.name === strings.service);
  const ok = Boolean(sub && sub.price.amount === 1199 && sub.icon === "service:spotify");
  return { ok, operation: "still-add-subscription", created: sub ? { name: sub.name, price: sub.price, icon: sub.icon } : null, reason: ok ? null : "subscription not created as expected" };
}
