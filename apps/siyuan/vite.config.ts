import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Builds the frontend half of the plugin: SiYuan evaluates `index.js` as a
 * CommonJS module (with `require("siyuan")` provided) and loads `index.css`.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
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
      entry: "src/frontend/index.tsx",
      formats: ["cjs"],
      fileName: () => "index.js",
      cssFileName: "index",
    },
    rolldownOptions: {
      external: ["siyuan"],
      output: { exports: "default" },
    },
  },
}));
