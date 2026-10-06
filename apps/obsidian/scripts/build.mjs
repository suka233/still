#!/usr/bin/env node
/**
 * Builds the Obsidian plugin into dist/:
 *   main.js, styles.css   (Vite)
 *   manifest.json, versions.json   (copied from the repository root)
 *
 *   node scripts/build.mjs            production build
 *   node scripts/build.mjs --watch    development build, rebuilds on change
 *
 * Link dist/ into a vault with scripts/link.mjs; Obsidian picks up changes
 * after "Reload app without saving" (or the Hot Reload plugin).
 */
import { cpSync, mkdirSync, rmSync, watch as watchFs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build as viteBuild } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const watch = process.argv.includes("--watch");
const mode = watch ? "development" : "production";

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Obsidian reads manifest.json and versions.json from the repository root, so that's where they live.
const repoRoot = resolve(root, "../..");
function copyStatic() {
  for (const name of ["manifest.json", "versions.json"]) cpSync(join(repoRoot, name), join(dist, name));
}
copyStatic();

if (watch) {
  watchFs(join(repoRoot, "manifest.json"), () => copyStatic());
  await viteBuild({ root, mode, configFile: join(root, "vite.config.ts"), build: { watch: {} } });
} else {
  await viteBuild({ root, mode, configFile: join(root, "vite.config.ts"), logLevel: "warn" });
}
