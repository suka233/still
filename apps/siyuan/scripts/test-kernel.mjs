#!/usr/bin/env node
/**
 * Runs the built kernel.js inside real goja (the engine SiYuan embeds) against
 * a mocked `siyuan` global. Needs Go to build tools/goja-runner; set
 * STILL_SKIP_GOJA=1 to skip where Go isn't available.
 */
import * as esbuild from "esbuild";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runnerDir = resolve(root, "../../tools/goja-runner");
const runner = join(runnerDir, process.platform === "win32" ? "goja-runner.exe" : "goja-runner");

if (process.env.STILL_SKIP_GOJA) {
  console.log("[still] STILL_SKIP_GOJA set, skipping goja kernel test");
  process.exit(0);
}
if (spawnSync("go", ["version"]).status !== 0) {
  console.error("[still] Go is required for the goja kernel test (or set STILL_SKIP_GOJA=1)");
  process.exit(1);
}

execFileSync("go", ["build", "-o", runner, "."], { cwd: runnerDir, stdio: "inherit" });

const out = join(mkdtempSync(join(tmpdir(), "still-kernel-")), "kernel.js");
await esbuild.build({
  entryPoints: [join(root, "src/kernel/index.ts")],
  outfile: out,
  bundle: true,
  format: "iife",
  platform: "neutral",
  target: "es2020",
  minify: true, // test the shipped shape
  logLevel: "warning",
});

const result = spawnSync(runner, [join(root, "test/kernel/mock-siyuan.js"), out, join(root, "test/kernel/scenario.js")], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
