import { parseSiteConfiguration } from "./domain";
import { SITE_CONFIG_STORAGE_KEY, type SiteConfiguration } from "./types";
export type SiteConfigStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;
export function restoreSiteConfiguration(storage: SiteConfigStorage | null) {
  if (!storage) return { status: "unavailable" as const, content: null };
  try {
    const raw = storage.getItem(SITE_CONFIG_STORAGE_KEY);
    if (raw === null) return { status: "empty" as const, content: null };
    const content = parseSiteConfiguration(JSON.parse(raw));
    if (content) return { status: "restored" as const, content };
    storage.removeItem(SITE_CONFIG_STORAGE_KEY);
    return { status: "invalid" as const, content: null };
  } catch {
    try {
      storage.removeItem(SITE_CONFIG_STORAGE_KEY);
    } catch {}
    return { status: "invalid" as const, content: null };
  }
}
export function persistSiteConfiguration(
  storage: SiteConfigStorage | null,
  content: SiteConfiguration,
) {
  if (!storage) return false;
  try {
    storage.setItem(SITE_CONFIG_STORAGE_KEY, JSON.stringify(content));
    return true;
  } catch {
    return false;
  }
}
export function clearSiteConfiguration(storage: SiteConfigStorage | null) {
  try {
    storage?.removeItem(SITE_CONFIG_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
