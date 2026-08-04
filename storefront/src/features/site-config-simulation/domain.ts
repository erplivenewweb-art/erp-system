import { cloneSiteConfiguration } from "./defaults";
import { SITE_CONFIG_VERSION, type SiteConfiguration } from "./types";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const localUrl = (value: unknown) =>
  typeof value === "string" &&
  value.startsWith("/") &&
  !value.startsWith("//") &&
  value.length <= 200;
export function parseSiteConfiguration(
  value: unknown,
): SiteConfiguration | null {
  if (!record(value) || value.version !== SITE_CONFIG_VERSION) return null;
  const candidate = value as unknown as SiteConfiguration;
  if (
    !record(candidate.header) ||
    !Array.isArray(candidate.navigation) ||
    !record(candidate.footer) ||
    !record(candidate.announcement) ||
    !record(candidate.seo)
  )
    return null;
  if (!candidate.header.logoText?.trim() || candidate.navigation.length > 40)
    return null;
  if (
    new Set(candidate.navigation.map((item) => item.id)).size !==
    candidate.navigation.length
  )
    return null;
  if (
    candidate.navigation.some(
      (item) =>
        !record(item) ||
        !item.id?.trim() ||
        !item.label?.trim() ||
        !localUrl(item.url) ||
        !["PRIMARY", "SECONDARY"].includes(item.area) ||
        typeof item.visible !== "boolean" ||
        !Number.isSafeInteger(item.sortOrder) ||
        typeof item.openInNewTab !== "boolean",
    )
  )
    return null;
  if (
    !Array.isArray(candidate.footer.links) ||
    candidate.footer.links.some(
      (item) =>
        !record(item) ||
        !item.id?.trim() ||
        !item.label?.trim() ||
        !localUrl(item.url),
    )
  )
    return null;
  if (
    [
      candidate.footer.companyName,
      candidate.footer.description,
      candidate.footer.copyright,
      candidate.footer.phone,
      candidate.footer.email,
      candidate.footer.address,
      candidate.footer.whatsappLabel,
      candidate.footer.instagram,
      candidate.footer.facebook,
      candidate.footer.youtube,
      candidate.footer.notice,
    ].some((item) => typeof item !== "string")
  )
    return null;
  if (
    !localUrl(candidate.announcement.ctaUrl) ||
    !Number.isSafeInteger(candidate.announcement.priority) ||
    typeof candidate.announcement.visible !== "boolean" ||
    typeof candidate.announcement.dismissible !== "boolean" ||
    !["surface-inverse", "brand-silver", "brand-vermilion"].includes(
      candidate.announcement.backgroundToken,
    ) ||
    !["text-inverse", "text-primary"].includes(candidate.announcement.textToken)
  )
    return null;
  if (
    typeof candidate.seo.noindex !== "boolean" ||
    typeof candidate.seo.nofollow !== "boolean"
  )
    return null;
  try {
    new URL(candidate.seo.canonicalBaseUrl);
  } catch {
    return null;
  }
  const result = cloneSiteConfiguration();
  result.header = {
    logoText: candidate.header.logoText.trim().slice(0, 60),
    logoSubtitle: candidate.header.logoSubtitle.trim().slice(0, 60),
  };
  result.navigation = candidate.navigation.map((item) => ({
    id: item.id.trim().slice(0, 80),
    label: item.label.trim().slice(0, 60),
    url: item.url,
    area: item.area,
    visible: item.visible,
    sortOrder: item.sortOrder,
    openInNewTab: item.openInNewTab,
    developmentNote: String(item.developmentNote ?? "")
      .trim()
      .slice(0, 120),
    icon: String(item.icon ?? "placeholder")
      .trim()
      .slice(0, 40),
  }));
  result.footer = {
    ...result.footer,
    companyName: String(candidate.footer.companyName).trim().slice(0, 120),
    description: String(candidate.footer.description).trim().slice(0, 240),
    copyright: String(candidate.footer.copyright).trim().slice(0, 120),
    phone: String(candidate.footer.phone).trim().slice(0, 60),
    email: String(candidate.footer.email).trim().slice(0, 120),
    address: String(candidate.footer.address).trim().slice(0, 240),
    whatsappLabel: String(candidate.footer.whatsappLabel).trim().slice(0, 60),
    instagram: String(candidate.footer.instagram).trim().slice(0, 200),
    facebook: String(candidate.footer.facebook).trim().slice(0, 200),
    youtube: String(candidate.footer.youtube).trim().slice(0, 200),
    notice: String(candidate.footer.notice).trim().slice(0, 160),
    links: candidate.footer.links.map((item) => ({
      id: item.id,
      label: item.label,
      url: item.url,
      group: item.group,
    })),
  };
  result.announcement = { ...candidate.announcement };
  result.seo = { ...candidate.seo };
  return result;
}
export const siteConfigurationEqual = (
  a: SiteConfiguration,
  b: SiteConfiguration,
) => JSON.stringify(a) === JSON.stringify(b);
export const orderedVisibleNavigation = (
  content: SiteConfiguration,
  area: "PRIMARY" | "SECONDARY",
) =>
  content.navigation
    .filter((item) => item.area === area && item.visible)
    .toSorted(
      (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
    );
