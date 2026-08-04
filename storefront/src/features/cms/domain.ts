import { cloneCMSContent, defaultCMSContent } from "./defaults";
import {
  CMS_SCHEMA_VERSION,
  type AnnouncementPreset,
  type CMSContent,
} from "./types";

const PRESETS: readonly AnnouncementPreset[] = ["ink", "silver", "vermilion"];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, maximum: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, maximum);
  return normalized || null;
}

function boolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

export function parseCMSContent(value: unknown): CMSContent | null {
  if (!record(value) || value.version !== CMS_SCHEMA_VERSION) return null;
  const homepage = value.homepage;
  const marketing = value.marketing;
  if (!record(homepage) || !record(marketing)) return null;
  const hero = homepage.hero;
  const sections = homepage.sections;
  const announcement = marketing.announcement;
  const wholesale = marketing.wholesale;
  const seasonal = marketing.seasonalCampaign;
  const footer = marketing.footer;
  if (
    !record(hero) ||
    !record(sections) ||
    !record(announcement) ||
    !record(wholesale) ||
    !record(seasonal) ||
    !record(footer)
  )
    return null;

  const preset = announcement.colorPreset;
  if (
    typeof preset !== "string" ||
    !PRESETS.includes(preset as AnnouncementPreset)
  )
    return null;

  const result = cloneCMSContent();
  const heroText = {
    badge: text(hero.badge, 60),
    title: text(hero.title, 120),
    subtitle: text(hero.subtitle, 280),
    primaryCta: text(hero.primaryCta, 40),
    secondaryCta: text(hero.secondaryCta, 40),
    mediaLabel: text(hero.mediaLabel, 80),
    festivalBannerText: text(hero.festivalBannerText, 100),
  };
  if (Object.values(heroText).some((item) => item === null)) return null;
  Object.assign(result.homepage.hero, heroText, {
    festivalBannerEnabled: boolean(hero.festivalBannerEnabled),
  });
  if (result.homepage.hero.festivalBannerEnabled === null) return null;

  const sectionTextKeys = [
    "trendingTitle",
    "trendingDescription",
    "newArrivalsTitle",
    "newArrivalsDescription",
    "collectionsTitle",
    "collectionsDescription",
    "editorialTitle",
    "editorialDescription",
    "aboutHeading",
    "aboutParagraph",
    "contactHeading",
    "contactDescription",
    "contactPhone",
    "contactEmail",
  ] as const;
  for (const key of sectionTextKeys) {
    const normalized = text(
      sections[key],
      key.includes("Description") || key === "aboutParagraph" ? 280 : 120,
    );
    if (!normalized) return null;
    result.homepage.sections[key] = normalized;
  }
  const toggleKeys = [
    "trendingEnabled",
    "newArrivalsEnabled",
    "featuredCollectionsEnabled",
    "editorialEnabled",
    "aboutEnabled",
    "contactEnabled",
  ] as const;
  for (const key of toggleKeys) {
    const normalized = boolean(sections[key]);
    if (normalized === null) return null;
    result.homepage.sections[key] = normalized;
  }

  const marketingValues = {
    whatsappCta: text(marketing.whatsappCta, 40),
    announcementText: text(announcement.text, 120),
    announcementCta: text(announcement.ctaLabel, 40),
    wholesaleHeadline: text(wholesale.headline, 120),
    wholesaleDescription: text(wholesale.description, 280),
    wholesaleCta: text(wholesale.ctaLabel, 40),
    seasonalHeadline: text(seasonal.headline, 120),
    seasonalDescription: text(seasonal.description, 280),
    copyright: text(footer.copyright, 120),
    disclaimer: text(footer.disclaimer, 200),
    developmentNotice: text(footer.developmentNotice, 160),
  };
  if (Object.values(marketingValues).some((item) => item === null)) return null;
  const announcementEnabled = boolean(announcement.enabled);
  const seasonalEnabled = boolean(seasonal.enabled);
  if (announcementEnabled === null || seasonalEnabled === null) return null;
  result.marketing = {
    announcement: {
      enabled: announcementEnabled,
      text: marketingValues.announcementText!,
      ctaLabel: marketingValues.announcementCta!,
      colorPreset: preset as AnnouncementPreset,
    },
    whatsappCta: marketingValues.whatsappCta!,
    wholesale: {
      headline: marketingValues.wholesaleHeadline!,
      description: marketingValues.wholesaleDescription!,
      ctaLabel: marketingValues.wholesaleCta!,
    },
    seasonalCampaign: {
      enabled: seasonalEnabled,
      headline: marketingValues.seasonalHeadline!,
      description: marketingValues.seasonalDescription!,
    },
    footer: {
      copyright: marketingValues.copyright!,
      disclaimer: marketingValues.disclaimer!,
      developmentNotice: marketingValues.developmentNotice!,
    },
  };
  return result;
}

export function resetHomepage(content: CMSContent) {
  return { ...content, homepage: cloneCMSContent(defaultCMSContent).homepage };
}

export function resetMarketing(content: CMSContent) {
  return {
    ...content,
    marketing: cloneCMSContent(defaultCMSContent).marketing,
  };
}

export function contentEqual(a: CMSContent, b: CMSContent) {
  return JSON.stringify(a) === JSON.stringify(b);
}
