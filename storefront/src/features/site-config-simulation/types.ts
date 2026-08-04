export const SITE_CONFIG_VERSION = 1;
export const SITE_CONFIG_STORAGE_KEY =
  "silver-sankha-development-site-config-v1";

export type NavigationArea = "PRIMARY" | "SECONDARY";
export type AnnouncementToken =
  "surface-inverse" | "brand-silver" | "brand-vermilion";
export interface SiteNavigationItem {
  id: string;
  label: string;
  url: string;
  area: NavigationArea;
  visible: boolean;
  sortOrder: number;
  openInNewTab: boolean;
  developmentNote: string;
  icon: string;
}
export interface FooterLink {
  id: string;
  label: string;
  url: string;
  group: "CUSTOMER" | "WHOLESALE" | "COLLECTIONS" | "POLICIES";
}
export interface SiteConfiguration {
  version: typeof SITE_CONFIG_VERSION;
  header: { logoText: string; logoSubtitle: string };
  navigation: SiteNavigationItem[];
  footer: {
    companyName: string;
    description: string;
    copyright: string;
    phone: string;
    email: string;
    address: string;
    whatsappLabel: string;
    instagram: string;
    facebook: string;
    youtube: string;
    notice: string;
    links: FooterLink[];
  };
  announcement: {
    visible: boolean;
    message: string;
    ctaLabel: string;
    ctaUrl: string;
    backgroundToken: AnnouncementToken;
    textToken: "text-inverse" | "text-primary";
    priority: number;
    festivalBadge: string;
    dismissible: boolean;
  };
  seo: {
    homepageTitle: string;
    homepageDescription: string;
    productTitleTemplate: string;
    categoryTitleTemplate: string;
    collectionTitleTemplate: string;
    openGraphTitle: string;
    openGraphDescription: string;
    twitterTitle: string;
    twitterDescription: string;
    canonicalBaseUrl: string;
    robots: string;
    noindex: boolean;
    nofollow: boolean;
  };
}
export type SiteConfigStatus =
  "pending" | "ready" | "saved" | "recovered" | "unavailable" | "disabled";
