import Link from "next/link";
import { Container, Section, Stack } from "@/components/layout";
import { Breadcrumb } from "@/components/navigation";
import type { CatalogueCategory, CataloguePage, CatalogueQuery } from "./types";
import { CatalogueSearch } from "./CatalogueSearch";
import { DevelopmentCatalogueIndicator } from "./DevelopmentIndicator";
import { SimulationProductCard } from "./ProductCard";
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
          <div className={styles.catalogueLayout}>
            <form action="/products" className={styles.filters} method="get">
              <h2>Search and filters</h2>
              <CatalogueSearch
                initialValue={query.keyword}
                products={catalogue.items}
                showDevelopmentRecents={showDevelopmentIndicator}
              />
              <div className={styles.field}>
                <label htmlFor="catalogue-category">Category</label>
                <select
                  defaultValue={query.category ?? ""}
                  id="catalogue-category"
                  name="category"
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="catalogue-purity">Purity</label>
                <select
                  defaultValue={query.purity ?? ""}
                  id="catalogue-purity"
                  name="purity"
                >
                  <option value="">All purity presentations</option>
                  <option value="925_SILVER">925 silver</option>
                  <option value="999_SILVER">999 silver</option>
                  <option value="GOLD_PLATED">Gold-plated</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="catalogue-availability">Availability</label>
                <select
                  defaultValue={query.availability ?? ""}
                  id="catalogue-availability"
                  name="availability"
                >
                  <option value="">All availability</option>
                  <option value="IN_STOCK">In stock presentation</option>
                  <option value="LOW_STOCK">Low stock presentation</option>
                  <option value="MADE_TO_ORDER">Made to order</option>
                  <option value="OUT_OF_STOCK">
                    Out of stock presentation
                  </option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="catalogue-audience">Visibility</label>
                <select
                  defaultValue={query.audience ?? ""}
                  id="catalogue-audience"
                  name="audience"
                >
                  <option value="">All public-safe products</option>
                  <option value="B2C">Retail visible</option>
                  <option value="B2B">Wholesale enquiry visible</option>
                </select>
              </div>
              <div className={styles.filterActions}>
                <button className={styles.button} type="submit">
                  Apply filters
                </button>
                <Link className={styles.secondaryButton} href="/products">
                  Clear filters
                </Link>
              </div>
            </form>
            <div className={styles.results}>
              <div className={styles.resultHeader}>
                <h2>Catalogue results</h2>
                <p aria-live="polite">
                  {catalogue.page.total} simulated{" "}
                  {catalogue.page.total === 1 ? "product" : "products"}
                </p>
              </div>
              {catalogue.items.length ? (
                <div
                  aria-label="Simulated product catalogue"
                  className={styles.grid}
                >
                  {catalogue.items.map((product) => (
                    <SimulationProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className={styles.emptyExperience}>
                  <div aria-hidden="true" className={styles.emptyIllustration}>
                    <span>SS</span>
                  </div>
                  <CatalogueEmptyState />
                </div>
              )}
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
