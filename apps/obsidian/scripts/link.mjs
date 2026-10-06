#!/usr/bin/env node
/**
 * Symlinks dist/ into a vault as .obsidian/plugins/still, for local
 * development together with `pnpm dev`.
 *
 *   node scripts/link.mjs /path/to/vault
 */
import { existsSync, lstatSync, mkdirSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const vault = process.argv[2];
if (!vault || !existsSync(vault)) {
  console.error("usage: node scripts/link.mjs <vault folder>");
  process.exit(1);
}
const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const target = join(vault, ".obsidian/plugins/still");
if (existsSync(target) || lstatSync(target, { throwIfNoEntry: false })) {
  console.error(`${target} already exists; remove it first`);
  process.exit(1);
}
mkdirSync(dirname(target), { recursive: true });
symlinkSync(dist, target, "junction");
console.log(`linked ${target} -> ${dist}`);
