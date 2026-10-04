// Still tutorial: drop a live overview of your subscriptions into any note.
import { api, demoSubscriptions, resetStill } from "./_still.mjs";

export const meta = {
  id: "still-slash",
  title: "在笔记里插入订阅概览",
  host: "still",
  locales: ["zh-CN", "en-US"],
  i18n: {
    "zh-CN": { doc: "我的订阅", slash: "/xlm", intro: "这个月的订阅：" },
    "en-US": { doc: "My subscriptions", slash: "/still", intro: "Subscriptions this month:" },
  },
  viewport: { width: 1280, height: 720 },
  durationS: 8.8,
  cursorStyle: "precision-dart",
  hide: [],
  camera: { presetId: "glide-focus", zoom: 1.4, lagS: 0.1 },
  output: {
    mp4: { width: 1280, height: 720, fps: 30 },
    webp: { width: 960, height: 540, fps: 15, maxBytes: 5 * 1024 * 1024 },
  },
};

export async function seed({ page, locale, strings }) {
  await resetStill(page, { locale, subscriptions: demoSubscriptions(locale, { netflixDue: false }) });
  const dock = page.locator(".sy__stillupcoming");
  if (await dock.isVisible()) await page.locator('.dock__item:has(use[*|href="#iconStill"])').first().click();
  const notebook = (await api(page, "/api/notebook/lsNotebooks", {})).notebooks.filter((n) => !n.closed)[0].id;
  // Fresh demo document every run.
  const existing = await api(page, "/api/filetree/getIDsByHPath", { notebook, path: `/${strings.doc}` }).catch(() => []);
  for (const id of existing ?? []) await api(page, "/api/filetree/removeDocByID", { id });
  const id = await api(page, "/api/filetree/createDocWithMd", { notebook, path: `/${strings.doc}`, markdown: `${strings.intro}\n` });
  // Open the doc by clicking it in the file tree.
  const toggle = page.locator('.file-tree .b3-list-item[data-type="navigation-root"] .b3-list-item__toggle').first();
  if (!(await page.locator('.file-tree .b3-list-item[data-type="navigation-file"]').count())) await toggle.click();
  await page.locator('.file-tree .b3-list-item[data-type="navigation-file"]', { hasText: strings.doc }).first().click();
  await page.locator(".layout__center .protyle:not(.fn__none) .protyle-wysiwyg [data-type=NodeParagraph]").first().waitFor({ state: "visible" });
  await page.waitForTimeout(600);
  return { id };
}

export async function actions(driver) {
  const { at, moveTo, jumpTo, click, typeText, pointWithin, page, strings } = driver;
  const para = page.locator(".layout__center .protyle:not(.fn__none) .protyle-wysiwyg [data-type=NodeParagraph]").last();
  const end = await pointWithin(para, 0.9, 0.5);
  await jumpTo({ x: end.x + 120, y: end.y + 200 });

  await at(0.5);
  await moveTo(end, 520);
  await at(1.3);
  await click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await moveTo({ x: end.x + 60, y: end.y + 120 }, 360);
  await at(2.0);
  await typeText(strings.slash);
  const item = page.locator(".protyle-hint .b3-list-item", { hasText: /续了么|Still/ }).first();
  await item.waitFor({ state: "visible" });
  await at(3.4);
  await page.keyboard.press("Enter");
  await page.locator(".layout__center .protyle:not(.fn__none) [data-type=NodeTable]").first().waitFor({ state: "visible" });
  await at(4.4);
  await moveTo({ x: 1100, y: 640 }, 640);
}

export async function verify({ page }, seeded) {
  const md = await api(page, "/api/export/exportMdContent", { id: seeded.id });
  const ok = /\|.*\|/.test(md.content) && /Netflix/.test(md.content);
  return { ok, operation: "still-slash", hasTable: ok, reason: ok ? null : "no overview table in the document" };
}
