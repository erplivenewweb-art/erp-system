"use client";

import Link from "next/link";
import { Container, Section, Stack } from "@/components/layout";
import { Breadcrumb } from "@/components/navigation";
import { MediaReferencePreview } from "@/features/media-cms-simulation/MediaReferencePreview";
import { useMediaCMS } from "@/features/media-cms-simulation/MediaCMSProvider";
import { CatalogueEmptyState } from "./ProductListing";
import { SimulationProductCard } from "./ProductCard";
import type { CatalogueCategory, CatalogueProduct } from "./types";
import styles from "./Catalogue.module.css";

export function SimulationCategoryExperience({
  category,
  products,
}: {
  category: CatalogueCategory;
  products: readonly CatalogueProduct[];
}) {
  const mediaCMS = useMediaCMS();
  const categoryMedia = mediaCMS.content.categories[category.id];
  return (
    <>
      <Section>
        <Container>
          <Stack gap="lg">
            <Breadcrumb
              items={[
                { href: "/", label: "Home" },
                { href: "/products", label: "Products" },
                { label: category.title },
              ]}
            />
            <div className={styles.categoryBanner}>
              <MediaReferencePreview
                id={categoryMedia?.bannerId ?? null}
                label={`${category.title} banner`}
              />
              <span className={styles.eyebrow}>Curated category</span>
              <h1>{category.title}</h1>
              <p>{category.description}</p>
              <p>{products.length} fictional products</p>
            </div>
          </Stack>
        </Container>
      </Section>
      <Section>
        <Container>
          <div className={styles.categoryToolbar}>
            <div>
              <h2>Category products</h2>
              <p>Use the main catalogue for active development filters.</p>
            </div>
            <label>
              Sort presentation
              <select defaultValue="featured" disabled>
                <option value="featured">Featured</option>
                <option value="newest">Newest</option>
                <option value="price-asc">Price: low to high</option>
              </select>
            </label>
            <Link
              className={styles.secondaryButton}
              href={`/products?category=${category.slug}`}
            >
              Open filter panel
            </Link>
          </div>
          {products.length ? (
            <div
              aria-label={`${category.title} products`}
              className={styles.grid}
            >
              {products.map((product) => (
                <SimulationProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <CatalogueEmptyState />
          )}
        </Container>
      </Section>
    </>
  );
}
