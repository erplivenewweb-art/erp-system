"use client";

import Link from "next/link";
import { ProductIntentActions } from "@/features/customer-intent";
import { useDiscovery } from "@/features/discovery-simulation/DiscoveryProvider";
import { useMediaCMS } from "@/features/media-cms-simulation/MediaCMSProvider";
import { projectProductMedia } from "@/features/media-cms-simulation/projection";
import { CatalogueProductMedia } from "./CatalogueMedia";
import type { CatalogueProduct } from "./types";
import styles from "./Catalogue.module.css";

const purityLabel = {
  "925_SILVER": "925 silver",
  "999_SILVER": "999 silver",
  GOLD_PLATED: "Gold-plated",
} as const;

const availabilityLabel = {
  IN_STOCK: "In stock presentation",
  LOW_STOCK: "Low stock presentation",
  MADE_TO_ORDER: "Made to order",
  OUT_OF_STOCK: "Out of stock presentation",
} as const;

export function SimulationProductCard({
  product,
  highlight = "",
  onNavigate,
}: {
  product: CatalogueProduct;
  highlight?: string;
  onNavigate?: () => void;
}) {
  const discovery = useDiscovery();
  const mediaCMS = useMediaCMS();
  const displayedProduct = projectProductMedia(product, mediaCMS.content);
  const sizes = displayedProduct.variants
    .map((variant) => variant.size)
    .join(", ");
  const weights = [
    ...new Set(displayedProduct.variants.map((variant) => variant.weight)),
  ].join(", ");
  return (
    <article className={styles.card}>
      <CatalogueProductMedia media={displayedProduct.media[0]} />
      <div className={styles.cardBody}>
        <div className={styles.badges}>
          {product.badges.map((badge) => (
            <span className={styles.badge} key={badge}>
              {badge.replaceAll("_", " ")}
            </span>
          ))}
        </div>
        <p className={styles.availability}>
          {availabilityLabel[product.availability]}
        </p>
        <h3>
          <Link
            className={styles.cardLink}
            href={`/products/${product.slug}`}
            onClick={onNavigate}
          >
            <HighlightedTitle query={highlight} title={product.title} />
          </Link>
        </h3>
        <p className={styles.subtitle}>{product.category.title}</p>
        <ul
          aria-label={`${product.title} specifications`}
          className={styles.meta}
        >
          <li>{purityLabel[product.purity]}</li>
          <li>Sizes {sizes}</li>
          <li>{weights}</li>
        </ul>
        <p className={styles.price}>{product.price.label}</p>
        {product.b2bVisible ? <p>Wholesale enquiry available</p> : null}
        <div className={styles.cardActions}>
          <Link
            className={styles.secondaryButton}
            href={`/products/${product.slug}`}
          >
            View product details
          </Link>
          <ProductIntentActions compact product={product} />
          {discovery.enabled ? (
            <button
              aria-label={`${
                discovery.state.comparison.includes(product.id)
                  ? "Remove"
                  : "Add"
              } ${product.title} ${
                discovery.state.comparison.includes(product.id) ? "from" : "to"
              } comparison`}
              aria-pressed={discovery.state.comparison.includes(product.id)}
              onClick={() => discovery.toggleComparison(product.id)}
              type="button"
            >
              {discovery.state.comparison.includes(product.id)
                ? "Compared"
                : "Compare"}
            </button>
          ) : null}
          <button
            aria-label={`Quick view ${product.title}`}
            disabled
            title="Quick View is a development placeholder"
            type="button"
          >
            Quick View preview
          </button>
        </div>
      </div>
    </article>
  );
}

function HighlightedTitle({ title, query }: { title: string; query: string }) {
  const normalized = query.trim();
  const index = title
    .toLocaleLowerCase("en")
    .indexOf(normalized.toLocaleLowerCase("en"));
  if (!normalized || index < 0) return title;
  return (
    <>
      {title.slice(0, index)}
      <mark>{title.slice(index, index + normalized.length)}</mark>
      {title.slice(index + normalized.length)}
    </>
  );
}
