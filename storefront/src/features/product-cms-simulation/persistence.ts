import { parseProductCMSContent } from "./domain";
import { PRODUCT_CMS_STORAGE_KEY, type ProductCMSContent } from "./types";

export type ProductCMSStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export function restoreProductCMSContent(storage: ProductCMSStorage | null) {
  if (!storage) return { status: "unavailable" as const, content: null };
  try {
    const raw = storage.getItem(PRODUCT_CMS_STORAGE_KEY);
    if (raw === null) return { status: "empty" as const, content: null };
    const content = parseProductCMSContent(JSON.parse(raw));
    if (content) return { status: "restored" as const, content };
    storage.removeItem(PRODUCT_CMS_STORAGE_KEY);
    return { status: "invalid" as const, content: null };
  } catch {
    try {
      storage.removeItem(PRODUCT_CMS_STORAGE_KEY);
    } catch {
      /* unavailable */
    }
    return { status: "invalid" as const, content: null };
  }
}

export function persistProductCMSContent(
  storage: ProductCMSStorage | null,
  content: ProductCMSContent,
) {
  if (!storage) return false;
  try {
    storage.setItem(PRODUCT_CMS_STORAGE_KEY, JSON.stringify(content));
    return true;
  } catch {
    return false;
  }
}

export function clearProductCMSContent(storage: ProductCMSStorage | null) {
  try {
    storage?.removeItem(PRODUCT_CMS_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
