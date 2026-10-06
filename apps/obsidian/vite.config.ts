import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { transform, type Selector } from "lightningcss";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

/**
 * Obsidian's app stylesheet styles bare elements (`button:not(.clickable-icon)`,
 * `input[type=text]`, `select` …) at a higher specificity than Still's class
 * utilities. So in this build every Still rule gets one extra id of
 * specificity (`:not(#\#)`, which matches everything), lifting all of Still's
 * CSS above Obsidian's element styles while keeping its own order intact.
 * `obsidian-reset.css` is added unbumped: it neutralises Obsidian's element
 * styles inside Still's scopes and loses to every Still rule.
 */
const BUMP = { type: "pseudo-class", kind: "not", selectors: [[{ type: "id", name: "#" }]] } as const;

function bump(selector: Selector): Selector {
  let at = selector.length;
  for (let i = selector.length - 1; i >= 0; i--) {
    const c = selector[i]!;
    if (c.type === "combinator") break;
    if (c.type === "pseudo-element") at = i; // `:not()` must come before `::before`
  }
  return [...selector.slice(0, at), BUMP as never, ...selector.slice(at)];
}

function outrankObsidian(minify: boolean): Plugin {
  const reset = readFileSync(fileURLToPath(new URL("./src/obsidian-reset.css", import.meta.url)), "utf8");
  return {
    name: "still:outrank-obsidian",
    apply: "build",
    // After Vite has written styles.css (its CSS is emitted late in generateBundle).
    writeBundle(options, bundle) {
      for (const asset of Object.values(bundle)) {
        if (asset.type !== "asset" || !asset.fileName.endsWith(".css")) continue;
        const path = join(options.dir!, asset.fileName);
        const { code } = transform({
          filename: asset.fileName,
          code: readFileSync(path),
          minify,
          // Top-level selectors only (not :is()/:where() arguments, which would double-count).
          // @scope bounds get bumped too, which is harmless: they don't add specificity.
          // (A Rule visitor would be cleaner but can't round-trip rules with var().)
          visitor: { Selector: bump },
        });
        writeFileSync(path, `${reset}\n${code.toString()}`);
      }
    },
  };
}

/**
 * Obsidian loads `main.js` as a CommonJS module (with `require("obsidian")`
 * provided) and `styles.css` globally; both land in dist/ next to the manifest.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), outrankObsidian(mode !== "development")],
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode === "development" ? "development" : "production"),
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    target: "es2020",
    cssCodeSplit: false,
    minify: mode !== "development",
    sourcemap: mode === "development" ? "inline" : false,
    lib: {
      entry: "src/main.tsx",
      formats: ["cjs"],
      fileName: () => "main.js",
      cssFileName: "styles",
    },
    rolldownOptions: {
      // Provided by Obsidian at runtime.
      external: ["obsidian", "electron", /^@codemirror\//, /^@lezer\//],
      output: { exports: "default" },
    },
  },
}));
