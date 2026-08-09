import Link from "next/link";
import { Container, Section, Stack } from "@/components/layout";
import { Breadcrumb } from "@/components/navigation";
import { DiscoveryListing } from "@/features/discovery-simulation";
import type { CatalogueCategory, CataloguePage, CatalogueQuery } from "./types";
import { DevelopmentCatalogueIndicator } from "./DevelopmentIndicator";
import styles from "./Catalogue.module.css";

export function CatalogueEmptyState() {
  return (
    <div className={styles.empty} role="status">
      <h2>No simulated products match</h2>
      <p>Clear the current filters or try a shorter search.</p>
      <Link className={styles.secondaryButton} href="/products">
        Clear filters
      </Link>
    </div>
  );
}

export function CatalogueErrorState({ code }: { code: string }) {
  return (
    <div className={styles.error} role="alert">
      <h2>Development catalogue unavailable</h2>
      <p>The simulated provider could not return a safe catalogue response.</p>
      <p>Diagnostic: {code}</p>
      <Link className={styles.secondaryButton} href="/products">
        Return to catalogue
      </Link>
    </div>
  );
}

export function ProductListing({
  catalogue,
  categories,
  query,
  showDevelopmentIndicator,
}: {
  catalogue: CataloguePage;
  categories: readonly CatalogueCategory[];
  query: CatalogueQuery;
  showDevelopmentIndicator: boolean;
}) {
  return (
    <>
      <Section>
        <Container>
          <Stack gap="lg">
            <Breadcrumb
              items={[{ href: "/", label: "Home" }, { label: "Products" }]}
            />
            <div className={styles.hero}>
              <span className={styles.eyebrow}>
                Public catalogue simulation
              </span>
              <h1>Jewellery forms for thoughtful discovery</h1>
              <p className={styles.lede}>
                Explore fictional Silver Sankha, Pola and related jewellery with
                stable development-only facts.
              </p>
              <DevelopmentCatalogueIndicator
                visible={showDevelopmentIndicator}
              />
            </div>
          </Stack>
        </Container>
      </Section>
      <Section>
        <Container>
          <DiscoveryListing
            categories={categories}
            enabled={showDevelopmentIndicator}
            products={catalogue.items}
            query={query}
          />
        </Container>
      </Section>
    </>
  );
}
