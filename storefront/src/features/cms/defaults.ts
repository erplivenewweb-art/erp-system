import { homeContent } from "@/features/home/content";
import { CMS_SCHEMA_VERSION, type CMSContent } from "./types";

export const defaultCMSContent: CMSContent = {
  version: CMS_SCHEMA_VERSION,
  homepage: {
    hero: {
      badge: homeContent.hero.eyebrow,
      title: homeContent.hero.title,
      subtitle: homeContent.hero.description,
      primaryCta: homeContent.hero.primary.label,
      secondaryCta: homeContent.hero.secondary.label,
      mediaLabel: "Development hero placeholder",
      festivalBannerEnabled: false,
      festivalBannerText: "Seasonal collection preview",
    },
    sections: {
      trendingEnabled: true,
      trendingTitle: homeContent.products.title,
      trendingDescription: homeContent.products.description,
      newArrivalsEnabled: true,
      newArrivalsTitle: "Fresh expressions in the development collection.",
      newArrivalsDescription:
        "New labels are deterministic presentation data, never live inventory.",
      featuredCollectionsEnabled: true,
      collectionsTitle: homeContent.collections.title,
      collectionsDescription: homeContent.collections.description,
      editorialEnabled: true,
      editorialTitle: homeContent.journal.title,
      editorialDescription: homeContent.journal.description,
      aboutEnabled: true,
      aboutHeading: "A manufacturer-led jewellery house",
      aboutParagraph:
        "Silver Sankha brings ceremonial form, material clarity and considered service into one calm public experience.",
      contactEnabled: true,
      contactHeading: "Continue the conversation",
      contactDescription:
        "Contact details are fictional placeholders in this development simulation.",
      contactPhone: "+91 00000 00000",
      contactEmail: "hello@example.invalid",
    },
  },
  marketing: {
    announcement: {
      enabled: true,
      text: "Development catalogue — simulated content",
      ctaLabel: "Explore products",
      colorPreset: "ink",
    },
    whatsappCta: "WhatsApp preview",
    wholesale: {
      headline: homeContent.wholesale.title,
      description: homeContent.wholesale.description,
      ctaLabel: homeContent.wholesale.action.label,
    },
    seasonalCampaign: {
      enabled: false,
      headline: "Festival edit preview",
      description: "A fictional seasonal campaign with no offer or live stock.",
    },
    footer: {
      copyright: "Silver Sankha. Public simulation.",
      disclaimer: "No orders, payments or inventory actions are enabled.",
      developmentNotice: "Development content — stored only in this browser.",
    },
  },
};

export function cloneCMSContent(content: CMSContent = defaultCMSContent) {
  return structuredClone(content);
}
