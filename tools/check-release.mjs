#!/usr/bin/env node
/**
 * Both plugins ship from one GitHub release, so their versions move together:
 *   apps/siyuan/plugin.json   (SiYuan bazaar: installs package.zip from the latest release)
 *   manifest.json             (Obsidian: reads it from the repo root; the release tag must equal it)
 *   versions.json             (Obsidian: maps each version to its minimum app version)
 *
 *   node tools/check-release.mjs [tag]
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const siyuan = read("apps/siyuan/plugin.json");
const obsidian = read("manifest.json");
const versions = read("versions.json");
const errors = [];

if (siyuan.version !== obsidian.version) errors.push(`apps/siyuan/plugin.json is ${siyuan.version} but manifest.json is ${obsidian.version}`);
if (versions[obsidian.version] !== obsidian.minAppVersion) errors.push(`versions.json must map ${obsidian.version} to ${obsidian.minAppVersion}`);
const tag = process.argv[2];
if (tag && tag !== obsidian.version) errors.push(`tag ${tag} must equal the version (${obsidian.version}); Obsidian looks releases up by exact tag, without a "v"`);

if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  process.exit(1);
}
console.log(`✓ version ${obsidian.version}${tag ? ` matches tag ${tag}` : ""}`);
