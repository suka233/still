#!/usr/bin/env node
/**
 * Starts a SiYuan kernel on a dedicated dev workspace with Still installed
 * (symlinked from dist/), bazaar trust on and update downloads off. Open the
 * printed URL in a browser; run `pnpm dev` alongside to rebuild on change.
 *
 *   node scripts/serve.mjs [workspace]
 *
 * Env: SIYUAN_KERNEL (kernel binary), STILL_DEV_WORKSPACE, STILL_PORT (6899),
 *      STILL_LANG (zh-CN).
 */
import { spawn } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readlinkSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const workspace = resolve(process.argv[2] ?? process.env.STILL_DEV_WORKSPACE ?? join(homedir(), "SiYuan/still-dev"));
const port = process.env.STILL_PORT ?? "6899";
const lang = process.env.STILL_LANG ?? "zh-CN";
const base = `http://127.0.0.1:${port}`;

const defaultKernels = {
  darwin: "/Applications/SiYuan.app/Contents/Resources/kernel/SiYuan-Kernel",
  win32: join(process.env.LOCALAPPDATA ?? "", "Programs/SiYuan/resources/kernel/SiYuan-Kernel.exe"),
  linux: "/opt/SiYuan/resources/kernel/SiYuan-Kernel",
};
const kernel = process.env.SIYUAN_KERNEL ?? defaultKernels[process.platform];
if (!kernel || !existsSync(kernel)) {
  console.error(`SiYuan kernel not found at ${kernel}; set SIYUAN_KERNEL`);
  process.exit(1);
}
if (!existsSync(join(dist, "plugin.json"))) {
  console.error("dist/ is empty; run `pnpm build` or `pnpm dev` first");
  process.exit(1);
}

const pluginDir = join(workspace, "data/plugins/still");
mkdirSync(dirname(pluginDir), { recursive: true });
const existing = lstatSync(pluginDir, { throwIfNoEntry: false });
if (!existing) {
  symlinkSync(dist, pluginDir, "junction");
} else if (!existing.isSymbolicLink() || resolve(dirname(pluginDir), readlinkSync(pluginDir)) !== dist) {
  console.warn(`[still] ${pluginDir} exists and is not a link to dist/; leaving it alone`);
}

async function api(path, body = {}) {
  const res = await fetch(base + path, { method: "POST", body: JSON.stringify(body) });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`${path}: ${json.msg}`);
  return json.data;
}

const child = spawn(kernel, ["serve", "--workspace", workspace, "--port", port, "--lang", lang], {
  stdio: ["ignore", "ignore", "inherit"],
});
child.on("exit", (code) => process.exit(code ?? 0));
const stop = () => api("/api/system/exit", { force: true }).catch(() => child.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

for (let i = 0; ; i++) {
  try {
    await api("/api/system/version");
    break;
  } catch {
    if (i > 60) {
      console.error("kernel did not start");
      stop();
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

await api("/api/system/setDownloadInstallPkg", { downloadInstallPkg: false });
await api("/api/setting/setBazaar", { trust: true, petalDisabled: false });
await api("/api/petal/setPetalEnabled", { packageName: "still", enabled: true });

console.log(`[still] SiYuan ${await api("/api/system/version")} · workspace ${workspace}`);
console.log(`[still] open ${base}/stage/build/desktop/  (mobile: ${base}/stage/build/mobile/)`);
