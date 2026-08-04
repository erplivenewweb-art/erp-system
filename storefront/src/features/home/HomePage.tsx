"use client";

import Link from "next/link";
import { useCMSContent } from "@/features/cms";
import { MediaReferencePreview } from "@/features/media-cms-simulation/MediaReferencePreview";
import { useMediaCMS } from "@/features/media-cms-simulation/MediaCMSProvider";
import { projectHomeMedia } from "@/features/media-cms-simulation/projection";
import { useProductCMS } from "@/features/product-cms-simulation";
import { homeContent } from "./content";
import {
  CollectionsSection,
  HeroSection,
  TrustStrip,
} from "./sections/HeroAndDiscovery";
import {
  ManufacturingSection,
  PackagingSection,
  PuritySection,
  WorkshopSection,
} from "./sections/StoryAndTrust";
import {
  CustomSection,
  FaqSection,
  JournalSection,
  ReviewsSection,
  SocialSection,
  WholesaleSection,
} from "./sections/ConversionAndEditorial";
import { HomepageCatalogue } from "./HomepageCatalogue";
import styles from "./HomePage.module.css";

export function HomePage() {
  const cms = useCMSContent();
  const mediaCMS = useMediaCMS();
  const productCMS = useProductCMS();
  const { hero, sections } = cms.content.homepage;
  const marketing = cms.content.marketing;
  const projected = {
    ...homeContent,
    hero: {
      ...homeContent.hero,
      eyebrow: hero.badge,
      title: hero.title,
      description: hero.subtitle,
      primary: { ...homeContent.hero.primary, label: hero.primaryCta },
      secondary: { ...homeContent.hero.secondary, label: hero.secondaryCta },
      media: projectHomeMedia(
        { ...homeContent.hero.media, eyebrow: hero.mediaLabel },
        mediaCMS.content,
        mediaCMS.content.homepage.heroId,
      ),
    },
    collections: {
      ...homeContent.collections,
      title: sections.collectionsTitle,
      description: sections.collectionsDescription,
      items: homeContent.collections.items.map((item, index) => {
        const collection = productCMS.content.collections[index];
        const assignment = collection
          ? mediaCMS.content.collections[collection.id]
          : null;
        return item.media
          ? {
              ...item,
              media: projectHomeMedia(
                item.media,
                mediaCMS.content,
                assignment?.coverId ?? assignment?.bannerId ?? null,
              ),
            }
          : item;
      }),
    },
    wholesale: {
      ...homeContent.wholesale,
      title: marketing.wholesale.headline,
      description: marketing.wholesale.description,
      action: {
        ...homeContent.wholesale.action,
        label: marketing.wholesale.ctaLabel,
      },
    },
    journal: {
      ...homeContent.journal,
      title: sections.editorialTitle,
      description: sections.editorialDescription,
    },
  };

  return (
    <div className={styles.home}>
      {hero.festivalBannerEnabled ? (
        <aside className={styles.campaignBanner}>
          {hero.festivalBannerText}
          <MediaReferencePreview
            id={mediaCMS.content.homepage.festivalBannerId}
            label="Festival banner media"
          />
        </aside>
      ) : null}
      {marketing.announcement.enabled ? (
        <MediaReferencePreview
          id={mediaCMS.content.homepage.announcementImageId}
          label="Announcement media"
        />
      ) : null}
      {marketing.seasonalCampaign.enabled ? (
        <section className={styles.seasonalCampaign}>
          <p className={styles.eyebrow}>Seasonal campaign simulation</p>
          <h2>{marketing.seasonalCampaign.headline}</h2>
          <p>{marketing.seasonalCampaign.description}</p>
        </section>
      ) : null}
      <HeroSection content={projected.hero} />
      <MediaReferencePreview
        id={mediaCMS.content.homepage.featuredBannerId}
        label="Featured banner media"
      />
      <TrustStrip items={homeContent.trust} />
      {sections.featuredCollectionsEnabled ? (
        <CollectionsSection content={projected.collections} />
      ) : null}
      <HomepageCatalogue
        newArrivals={{
          enabled: sections.newArrivalsEnabled,
          title: sections.newArrivalsTitle,
          description: sections.newArrivalsDescription,
        }}
        trending={{
          enabled: sections.trendingEnabled,
          title: sections.trendingTitle,
          description: sections.trendingDescription,
        }}
      />
      <ManufacturingSection content={homeContent.manufacturing} />
      <WorkshopSection content={homeContent.workshop} />
      <PuritySection content={homeContent.purity} />
      <CustomSection content={homeContent.custom} />
      <WholesaleSection content={projected.wholesale} />
      <PackagingSection content={homeContent.packaging} />
      <ReviewsSection content={homeContent.reviews} />
      <SocialSection content={homeContent.social} />
      {sections.editorialEnabled ? (
        <JournalSection content={projected.journal} />
      ) : null}
      {sections.aboutEnabled ? (
        <section className={styles.marketingPreview}>
          <p className={styles.eyebrow}>About preview</p>
          <h2>{sections.aboutHeading}</h2>
          <p>{sections.aboutParagraph}</p>
          <Link href="/about">Read our story</Link>
        </section>
      ) : null}
      {sections.contactEnabled ? (
        <section className={styles.marketingPreview}>
          <p className={styles.eyebrow}>Contact preview</p>
          <h2>{sections.contactHeading}</h2>
          <p>{sections.contactDescription}</p>
          <p>
            {sections.contactPhone} · {sections.contactEmail}
          </p>
          <Link href="/contact">Open contact page</Link>
        </section>
      ) : null}
      <FaqSection content={homeContent.faq} />
    </div>
  );
}
