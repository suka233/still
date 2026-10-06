#!/usr/bin/env bash
# Builds a working copy of the make-kmind-tutorial-slice-lite pipeline with
# Still's host registered, so clips can be recorded without touching the skill.
#
#   docs/tutorial/setup-recorder.sh [out-dir]
#
# SKILL_DIR overrides where the pipeline lives.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
skill="${SKILL_DIR:-$HOME/Documents/my-skill/make-kmind-tutorial-slice-lite}"
out="${1:-${TMPDIR:-/tmp}/still-recorder}"

[ -d "$skill/lib/hosts" ] || { echo "pipeline not found at $skill (set SKILL_DIR)" >&2; exit 1; }

rm -rf "$out"
mkdir -p "$out"
cp -R "$skill/lib" "$skill/scripts" "$skill/assets" "$skill/package.json" "$out/"
ln -s "$skill/node_modules" "$out/node_modules"
cp "$here/still-host.mjs" "$out/lib/hosts/still.mjs"

index="$out/lib/hosts/index.mjs"
grep -q 'still.mjs' "$index" || perl -0pi -e 's#(import \* as siyuan from "\./siyuan\.mjs";)#$1\nimport * as still from "./still.mjs";#; s#const HOSTS = \{ (.*?) \};#const HOSTS = { $1, still };#' "$index"
grep -q 'still' "$index" || { echo "could not register the still host in $index" >&2; exit 1; }

echo "$out"
