#!/usr/bin/env node
/**
 * Builds the SiYuan plugin into dist/:
 *   index.js + index.css  frontend (Vite, CommonJS)
 *   kernel.js             kernel plugin (esbuild, IIFE for goja's RunScript)
 *   plugin.json, i18n/, README*, icon.png, preview.png
 * and, for production builds, package.zip for the SiYuan bazaar.
 *
 *   node scripts/build.mjs            production build + package.zip
 *   node scripts/build.mjs --watch    development build, rebuilds on change
 */
import * as esbuild from "esbuild";
import { zipSync } from "fflate";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, watch as watchFs, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build as viteBuild } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const watch = process.argv.includes("--watch");
const mode = watch ? "development" : "production";

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

/** SiYuan's i18n files, with the engine's push and daily-note text merged in (SiYuan file names → engine catalogs). */
const engineMessages = join(root, "../../packages/engine/src/messages");
function writeI18n() {
  mkdirSync(join(dist, "i18n"), { recursive: true });
  for (const name of readdirSync(join(root, "src/i18n")).filter((n) => n.endsWith(".json"))) {
    const own = JSON.parse(readFileSync(join(root, "src/i18n", name), "utf8"));
    const engine = JSON.parse(readFileSync(join(engineMessages, name.startsWith("zh") ? "zh-CN.json" : "en.json"), "utf8"));
    writeFileSync(join(dist, "i18n", name), JSON.stringify({ ...engine, ...own }, null, 2) + "\n");
  }
}

function copyStatic() {
  cpSync(join(root, "plugin.json"), join(dist, "plugin.json"));
  writeI18n();
  for (const name of ["README.md", "README.zh-CN.md", "icon.png", "preview.png"]) {
    const from = join(root, name);
    if (existsSync(from)) cpSync(from, join(dist, name));
    else if (!watch) console.warn(`[still] missing ${name}; the bazaar requires it`);
  }
  cpSync(join(root, "../../LICENSE"), join(dist, "LICENSE"));
}

/** @type {esbuild.BuildOptions} */
const kernelOptions = {
  entryPoints: [join(root, "src/kernel/index.ts")],
  outfile: join(dist, "kernel.js"),
  bundle: true,
  // goja runs a plain script: no module syntax, everything in one closure.
  format: "iife",
  platform: "neutral",
  target: "es2020",
  minify: !watch,
  legalComments: "none",
  logLevel: "info",
};

function zipDist() {
  /** @type {Record<string, Uint8Array>} */
  const entries = {};
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else entries[relative(dist, path).split("\\").join("/")] = readFileSync(path);
    }
  };
  walk(dist);
  writeFileSync(join(root, "package.zip"), zipSync(entries, { level: 9 }));
  console.log(`[still] package.zip (${Object.keys(entries).length} files)`);
}

copyStatic();

if (watch) {
  // Keep i18n and the manifest in sync too; SiYuan reads them on plugin reload.
  for (const path of [join(root, "src/i18n"), engineMessages, join(root, "plugin.json")]) {
    watchFs(path, { recursive: true }, () => {
      try {
        copyStatic();
      } catch (e) {
        console.warn("[still] copy failed", e);
      }
    });
  }
  const ctx = await esbuild.context(kernelOptions);
  await ctx.watch();
  await viteBuild({ root, mode, configFile: join(root, "vite.config.ts"), build: { watch: {} } });
} else {
  await esbuild.build(kernelOptions);
  await viteBuild({ root, mode, configFile: join(root, "vite.config.ts"), logLevel: "warn" });
  zipDist();
}
