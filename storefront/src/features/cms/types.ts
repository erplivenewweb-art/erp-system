export const CMS_SCHEMA_VERSION = 1;
export const CMS_STORAGE_KEY = "silver-sankha-development-cms-v1";

export type AnnouncementPreset = "ink" | "silver" | "vermilion";

export interface CMSHomepageContent {
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    mediaLabel: string;
    festivalBannerEnabled: boolean;
    festivalBannerText: string;
  };
  sections: {
    trendingEnabled: boolean;
    trendingTitle: string;
    trendingDescription: string;
    newArrivalsEnabled: boolean;
    newArrivalsTitle: string;
    newArrivalsDescription: string;
    featuredCollectionsEnabled: boolean;
    collectionsTitle: string;
    collectionsDescription: string;
    editorialEnabled: boolean;
    editorialTitle: string;
    editorialDescription: string;
    aboutEnabled: boolean;
    aboutHeading: string;
    aboutParagraph: string;
    contactEnabled: boolean;
    contactHeading: string;
    contactDescription: string;
    contactPhone: string;
    contactEmail: string;
  };
}

export interface CMSMarketingContent {
  announcement: {
    enabled: boolean;
    text: string;
    ctaLabel: string;
    colorPreset: AnnouncementPreset;
  };
  whatsappCta: string;
  wholesale: {
    headline: string;
    description: string;
    ctaLabel: string;
  };
  seasonalCampaign: {
    enabled: boolean;
    headline: string;
    description: string;
  };
  footer: {
    copyright: string;
    disclaimer: string;
    developmentNotice: string;
  };
}

export interface CMSContent {
  version: typeof CMS_SCHEMA_VERSION;
  homepage: CMSHomepageContent;
  marketing: CMSMarketingContent;
}

export type CMSPersistenceStatus =
  "pending" | "ready" | "saved" | "recovered" | "unavailable" | "disabled";
