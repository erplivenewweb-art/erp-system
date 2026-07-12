import { homeContent } from "./content";
import { CollectionsSection, HeroSection, ProductsSection, TrustStrip } from "./sections/HeroAndDiscovery";
import { ManufacturingSection, PackagingSection, PuritySection, WorkshopSection } from "./sections/StoryAndTrust";
import { CustomSection, FaqSection, JournalSection, ReviewsSection, SocialSection, WholesaleSection } from "./sections/ConversionAndEditorial";
import styles from "./HomePage.module.css";

export function HomePage() {
  return <div className={styles.home}>
    <HeroSection content={homeContent.hero} />
    <TrustStrip items={homeContent.trust} />
    <CollectionsSection content={homeContent.collections} />
    <ProductsSection content={homeContent.products} />
    <ManufacturingSection content={homeContent.manufacturing} />
    <WorkshopSection content={homeContent.workshop} />
    <PuritySection content={homeContent.purity} />
    <CustomSection content={homeContent.custom} />
    <WholesaleSection content={homeContent.wholesale} />
    <PackagingSection content={homeContent.packaging} />
    <ReviewsSection content={homeContent.reviews} />
    <SocialSection content={homeContent.social} />
    <JournalSection content={homeContent.journal} />
    <FaqSection content={homeContent.faq} />
  </div>;
}

