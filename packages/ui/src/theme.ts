import type { Appearance } from "@still/core";

export type ThemeId = "host" | "clean" | "paper" | "aurora" | "terminal" | "candy";

export interface ThemeInfo {
  id: ThemeId;
  /** Representative colours for the picker: background, card, primary, foreground. */
  light: [string, string, string, string];
  dark: [string, string, string, string];
}

/** Order shown in the picker. "host" follows the host app's own theme. */
export const THEMES: readonly ThemeInfo[] = [
  { id: "host", light: ["#f5f5f5", "#ffffff", "#3575f0", "#202124"], dark: ["#1e1e1e", "#2a2a2a", "#3575f0", "#e8e8e8"] },
  { id: "clean", light: ["#ffffff", "#ffffff", "#18181b", "#18181b"], dark: ["#09090b", "#111113", "#fafafa", "#fafafa"] },
  { id: "paper", light: ["#f7f3ea", "#fffdf7", "#a0522d", "#3b2f2a"], dark: ["#1f1b16", "#29241d", "#d4915e", "#ece3d3"] },
  { id: "aurora", light: ["#e0e7ff", "#fdf2f8", "#7c3aed", "#1e1b4b"], dark: ["#312e81", "#6b21a8", "#a78bfa", "#ede9fe"] },
  { id: "terminal", light: ["#fbf7ef", "#fffcf5", "#b45309", "#3d2b00"], dark: ["#0a0f0a", "#0e150e", "#4ade80", "#b8f5b8"] },
  { id: "candy", light: ["#fff7fb", "#ffffff", "#ff4f9a", "#4a2c40"], dark: ["#241621", "#30202c", "#ff7ab6", "#ffe6f2"] },
];

export const DEFAULT_THEME: ThemeId = "host";

export function isThemeId(id: string): id is ThemeId {
  return THEMES.some((t) => t.id === id);
}

/** Accent presets; `null` keeps the theme's own primary colour. */
export const ACCENTS: readonly (string | null)[] = [null, "#3b82f6", "#7c3aed", "#db2777", "#e11d48", "#ea580c", "#ca8a04", "#16a34a", "#0d9488", "#0891b2"];

function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Black or white, whichever reads better on `hex`. */
export function readableOn(hex: string): string {
  return relativeLuminance(hex) > 0.45 ? "#111111" : "#ffffff";
}

export interface ResolvedAppearance {
  theme: ThemeId;
  dark: boolean;
  /** Inline custom properties (accent override). */
  style: Record<string, string>;
}

export function resolveAppearance(appearance: Appearance, hostDark: boolean): ResolvedAppearance {
  const theme = isThemeId(appearance.theme) ? appearance.theme : DEFAULT_THEME;
  const dark = appearance.mode === "auto" ? hostDark : appearance.mode === "dark";
  const style: Record<string, string> = {};
  if (appearance.accent) {
    style["--primary"] = appearance.accent;
    style["--primary-foreground"] = readableOn(appearance.accent);
    style["--ring"] = appearance.accent;
  }
  return { theme, dark, style };
}

const ACCENT_PROPS = ["--primary", "--primary-foreground", "--ring"];

/** Applies an appearance to a `.still-root` scope element. */
export function applyAppearance(el: HTMLElement, resolved: ResolvedAppearance) {
  el.dataset.stillTheme = resolved.theme;
  el.dataset.stillMode = resolved.dark ? "dark" : "light";
  for (const prop of ACCENT_PROPS) el.style.removeProperty(prop);
  for (const [prop, value] of Object.entries(resolved.style)) el.style.setProperty(prop, value);
}
