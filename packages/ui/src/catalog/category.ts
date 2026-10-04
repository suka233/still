import type { Translate } from "../i18n/index.js";
import { CATEGORY_IDS, type CategoryId } from "./services.js";

export function isCategoryId(value: string | null | undefined): value is CategoryId {
  return !!value && (CATEGORY_IDS as readonly string[]).includes(value);
}

/** Label for a stored category: built-in IDs are translated, free text is shown as is. */
export function categoryLabel(category: string | null | undefined, t: Translate): string {
  if (!category) return t("category.none");
  return isCategoryId(category) ? t(`category.${category}`) : category;
}
