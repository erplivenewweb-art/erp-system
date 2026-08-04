import { parseMediaCMSContent } from "./domain";
import { MEDIA_CMS_STORAGE_KEY, type MediaCMSContent } from "./types";

export type MediaStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function restoreMediaCMSContent(storage: MediaStorage | null) {
  if (!storage) return { status: "unavailable" as const, content: null };
  try {
    const raw = storage.getItem(MEDIA_CMS_STORAGE_KEY);
    if (raw === null) return { status: "empty" as const, content: null };
    const content = parseMediaCMSContent(JSON.parse(raw));
    if (content) return { status: "restored" as const, content };
    storage.removeItem(MEDIA_CMS_STORAGE_KEY);
    return { status: "invalid" as const, content: null };
  } catch {
    try {
      storage.removeItem(MEDIA_CMS_STORAGE_KEY);
    } catch {
      /* unavailable */
    }
    return { status: "invalid" as const, content: null };
  }
}

export function persistMediaCMSContent(
  storage: MediaStorage | null,
  content: MediaCMSContent,
) {
  if (!storage) return false;
  try {
    storage.setItem(MEDIA_CMS_STORAGE_KEY, JSON.stringify(content));
    return true;
  } catch {
    return false;
  }
}

export function clearMediaCMSContent(storage: MediaStorage | null) {
  try {
    storage?.removeItem(MEDIA_CMS_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
