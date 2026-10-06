import en from "./messages/en.json";
import zh from "./messages/zh-CN.json";

/** Push and daily-note text, shared by every host. Hosts may merge these into their own catalogs. */
export const MESSAGES: Record<"en" | "zh-CN", Record<string, string>> = { en, "zh-CN": zh };

/** Chinese for any zh* language, English otherwise. */
export function messagesFor(lang: string | undefined): Record<string, string> {
  return /^zh/i.test(lang ?? "") ? MESSAGES["zh-CN"] : MESSAGES.en;
}

export function createTranslator(catalog: Record<string, string>) {
  return (key: string, vars: Record<string, string | number> = {}): string => {
    let text = catalog[key] ?? key;
    for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
    return text;
  };
}
