import { parseCMSContent } from "./domain";
import { CMS_STORAGE_KEY, type CMSContent } from "./types";

export type CMSStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function restoreCMSContent(storage: CMSStorage | null) {
  if (!storage) return { status: "unavailable" as const, content: null };
  try {
    const raw = storage.getItem(CMS_STORAGE_KEY);
    if (raw === null) return { status: "empty" as const, content: null };
    const content = parseCMSContent(JSON.parse(raw));
    if (content) return { status: "restored" as const, content };
    storage.removeItem(CMS_STORAGE_KEY);
    return { status: "invalid" as const, content: null };
  } catch {
    try {
      storage.removeItem(CMS_STORAGE_KEY);
    } catch {
      /* unavailable */
    }
    return { status: "invalid" as const, content: null };
  }
}

export function persistCMSContent(
  storage: CMSStorage | null,
  content: CMSContent,
) {
  if (!storage) return false;
  try {
    storage.setItem(CMS_STORAGE_KEY, JSON.stringify(content));
    return true;
  } catch {
    return false;
  }
}

export function clearCMSContent(storage: CMSStorage | null) {
  try {
    storage?.removeItem(CMS_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
