#!/usr/bin/env node
/**
 * Symlinks dist/ into a SiYuan workspace as data/plugins/still, for local
 * development together with `pnpm dev`. SiYuan reloads kernel.js when it
 * changes; reload the window to pick up frontend changes.
 *
 *   node scripts/link.mjs /path/to/SiYuan/workspace
 */
import { existsSync, lstatSync, mkdirSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspace = process.argv[2];
if (!workspace || !existsSync(join(workspace, "data"))) {
  console.error("usage: node scripts/link.mjs <SiYuan workspace containing data/>");
  process.exit(1);
}
const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const target = join(workspace, "data/plugins/still");
if (existsSync(target) || lstatSync(target, { throwIfNoEntry: false })) {
  console.error(`${target} already exists; remove it first`);
  process.exit(1);
}
mkdirSync(dirname(target), { recursive: true });
symlinkSync(dist, target, "junction");
console.log(`linked ${target} -> ${dist}`);
