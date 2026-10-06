#!/usr/bin/env node
// Rebuild the 1024×768 store image from a Chinese dev kernel with demo data.
// Run only against a disposable workspace: seed.mjs --reset replaces Still data.
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { api, openDock, reloadStill, rpc } from "./clips/_still.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(join(repo, "tools/snap/package.json"))("playwright");
const run = promisify(execFile);
const baseUrl = `http://127.0.0.1:${process.env.STILL_PORT ?? "6899"}`;
const work = await mkdtemp(join(tmpdir(), "still-preview-"));
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, locale: "zh-CN", colorScheme: "light" });
  await page.goto(`${baseUrl}/stage/build/desktop/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (window.siyuan?.ws?.app?.plugins ?? []).some((p) => p.name === "still"));
  const conf = (await api(page, "/api/system/getConf")).conf;
  if (!conf.appearance.lang.startsWith("zh")) throw new Error("Store preview requires a Chinese kernel");
  await run(process.execPath, [join(repo, "apps/siyuan/scripts/seed.mjs"), "--reset"]);
  await rpc(page, "updateSettings", { appearance: { theme: "thermal", mode: "light", accent: null } });
  await page.waitForTimeout(1200);
  await api(page, "/api/file/removeFile", { path: "/data/storage/petal/still/delivered" });
  await reloadStill(page);
  await openDock(page);
  await page.locator(".stl-decide").waitFor({ state: "visible" });
  await page.waitForTimeout(1000);
  await page.mouse.move(20, 950);
  await page.addStyleTag({ content: '[role="tooltip"], .tooltip, #tooltip { visibility: hidden !important; } .sy__stillupcoming .stl-dock { min-height: 0 !important; overflow: visible !important; background: transparent !important; }' });
  await page.evaluate(() => {
    for (const selector of [".sy__stillupcoming .stl-dock", ".stl-decide"]) {
      for (let el = document.querySelector(selector)?.parentElement; el; el = el.parentElement) {
        el.style.setProperty("background", "transparent", "important");
      }
    }
    document.querySelectorAll('.still-portal > div[aria-hidden="true"]').forEach((el) => el.style.setProperty("display", "none", "important"));
  });
  const captures = {};
  for (const [name, selector] of [["dock", ".sy__stillupcoming .stl-dock"], ["card", ".stl-decide"]]) {
    const el = page.locator(selector).first();
    const box = await el.boundingBox();
    await el.screenshot({ path: join(work, `${name}.png`), omitBackground: true });
    captures[name] = { width: box.width, height: box.height, src: `data:image/png;base64,${(await readFile(join(work, `${name}.png`))).toString("base64")}` };
  }
  const composition = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  const dockWidth = Math.min(286, 660 * captures.dock.width / captures.dock.height);
  await composition.setContent(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;width:1024px;height:768px;overflow:hidden}
    body{background:#e6e3dd;color:#292722;font-family:"Songti SC","Noto Serif CJK SC",serif}
    .copy{position:absolute;left:64px;top:80px;width:340px}
    .eyebrow{font:12px/1.4 "SFMono-Regular",Menlo,monospace;letter-spacing:5px;color:#82796b;white-space:nowrap}
    h1{font-size:68px;line-height:1.1;margin:22px 0 0;font-weight:800;letter-spacing:1px}
    .english{font:700 32px/1.3 "SFMono-Regular",Menlo,monospace;color:#82796b}
    .subtitle{font-size:22px;line-height:1.55;margin:24px 0 26px}.subtitle b{color:#b9472f;font-weight:700}
    ul{list-style:none;padding:0;margin:0;font-size:16px;line-height:1.6}li{display:flex;gap:10px;margin:9px 0;white-space:nowrap}
    .tick{color:#b9472f;font-family:Arial,sans-serif;font-size:15px}
    .stamp{position:absolute;left:64px;bottom:55px;border:3px double #b9472f;padding:10px 16px 8px;color:#b9472f;font-size:18px;font-weight:700;letter-spacing:2px;transform:rotate(-3deg)}
    img{position:absolute;display:block;filter:drop-shadow(0 18px 20px rgba(64,53,36,.24))}
    .dock{left:426px;top:57px;width:${dockWidth}px;transform:rotate(-2deg);transform-origin:50% 20%}
    .card{left:651px;top:242px;width:331px;transform:rotate(2.5deg);transform-origin:50% 30%}
  </style><body><div class="copy"><div class="eyebrow">STILL · RENEWAL NOTICE</div><h1>续了么</h1><div class="english">Still</div>
  <p class="subtitle">续费之前，先问你一句：<br><b>还在用吗？</b></p><ul>
  <li><span class="tick">✓</span>扣费前提醒，试用转正前也提醒</li>
  <li><span class="tick">✓</span>续 / 不续了 / 再想想，一键决定</li>
  <li><span class="tick">✓</span>推送到手机：Bark、ntfy、Telegram、微信…</li>
  <li><span class="tick">✓</span>八套主题，跟随思源明暗</li></ul></div>
  <div class="stamp">思源笔记插件</div><img class="dock" src="${captures.dock.src}"><img class="card" src="${captures.card.src}"></body></html>`);
  await composition.evaluate(() => document.fonts.ready);
  await composition.locator("img").evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
  await mkdir(join(repo, "docs/media"), { recursive: true });
  const output = join(repo, "docs/media/preview.png");
  await composition.screenshot({ path: output });
  await copyFile(output, join(repo, "apps/siyuan/preview.png"));
  console.log(JSON.stringify({ output, width: 1024, height: 768, captures: Object.fromEntries(Object.entries(captures).map(([k, v]) => [k, { width: v.width, height: v.height }])) }));
} finally {
  await browser.close();
  await rm(work, { recursive: true, force: true });
}
