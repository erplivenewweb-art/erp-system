"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CatalogueProductMedia } from "@/features/catalogue-simulation/CatalogueMedia";
import type { CatalogueProduct } from "@/features/catalogue-simulation/types";
import { useProductCMS } from "@/features/product-cms-simulation";
import {
  cmsDiscoveryProducts,
  deterministicRecommendations,
  fixtureDiscoveryProducts,
} from "./domain";
import { DiscoveryScope, useDiscovery } from "./DiscoveryProvider";
import type { DiscoveryProduct } from "./types";
import styles from "./Discovery.module.css";

export function ProductDiscoveryBoundary({
  product,
  products,
  enabled,
}: {
  product: CatalogueProduct;
  products: readonly CatalogueProduct[];
  enabled: boolean;
}) {
  return (
    <DiscoveryScope enabled={enabled}>
      <ProductDiscoveryPanel product={product} products={products} />
    </DiscoveryScope>
  );
}

function ProductDiscoveryPanel({
  product,
  products,
}: {
  product: CatalogueProduct;
  products: readonly CatalogueProduct[];
}) {
  const discovery = useDiscovery();
  const cms = useProductCMS();
  const [shareStatus, setShareStatus] = useState("");
  const relativePath = `/products/${product.slug}`;
  const items = useMemo(
    () =>
      cms.enabled
        ? cmsDiscoveryProducts(
            cms.content.products,
            cms.content.categories,
            cms.content.collections,
          )
        : fixtureDiscoveryProducts(products),
    [cms.content, cms.enabled, products],
  );
  const current =
    items.find((item) => item.product.id === product.id) ??
    fixtureDiscoveryProducts([product])[0];
  const groups = deterministicRecommendations(current, items);
  const recent = discovery.state.recentlyViewed
    .map((id) => items.find((item) => item.product.id === id))
    .filter(
      (item): item is DiscoveryProduct =>
        Boolean(item) && item?.product.id !== product.id,
    )
    .slice(0, 3);

  useEffect(() => {
    discovery.markViewed(product.id);
  }, [discovery, product.id]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        new URL(relativePath, window.location.origin).toString(),
      );
      setShareStatus("Product link copied.");
    } catch {
      setShareStatus("Copy is unavailable in this browser.");
    }
  }

  function openShare(
    destination: "WHATSAPP" | "FACEBOOK" | "TWITTER" | "EMAIL",
  ) {
    const url = encodeURIComponent(
      new URL(relativePath, window.location.origin).toString(),
    );
    const title = encodeURIComponent(product.title);
    const target = {
      WHATSAPP: `https://wa.me/?text=${title}%20${url}`,
      FACEBOOK: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      TWITTER: `https://twitter.com/intent/tweet?text=${title}&url=${url}`,
      EMAIL: `mailto:?subject=${title}&body=${url}`,
    }[destination];
    if (destination === "EMAIL") window.location.assign(target);
    else window.open(target, "_blank", "noopener,noreferrer");
  }

  return (
    <section
      className={styles.discoveryPanel}
      aria-labelledby="discovery-panel-title"
    >
      <div className={styles.discoveryActions}>
        <div>
          <h2 id="discovery-panel-title">Discover and compare</h2>
          <p>
            Browser-local simulation only. No analytics or customer profiling.
          </p>
        </div>
        <button
          aria-pressed={discovery.state.comparison.includes(product.id)}
          onClick={() => {
            const result = discovery.toggleComparison(product.id);
            if (result === "limit")
              setShareStatus("Comparison limit is four products.");
          }}
          type="button"
        >
          {discovery.state.comparison.includes(product.id)
            ? "Remove from comparison"
            : "Add to comparison"}
        </button>
        <Link href="/compare">View comparison</Link>
      </div>
      <div className={styles.share} aria-label="Share product">
        <strong>Share</strong>
        <button onClick={copyLink} type="button">
          Copy link
        </button>
        <button onClick={() => openShare("WHATSAPP")} type="button">
          WhatsApp
        </button>
        <button onClick={() => openShare("FACEBOOK")} type="button">
          Facebook
        </button>
        <button onClick={() => openShare("TWITTER")} type="button">
          Twitter/X
        </button>
        <button onClick={() => openShare("EMAIL")} type="button">
          Email
        </button>
      </div>
      <p aria-live="polite" className={styles.status}>
        {shareStatus}
      </p>
      <RecommendationGroup items={groups.related} title="Related products" />
      <RecommendationGroup
        items={groups.alsoViewed}
        title="Customers also viewed"
      />
      <RecommendationGroup
        items={groups.recommended}
        title="Recommended for you"
      />
      <RecommendationGroup items={recent} title="Recently viewed" />
      {recent.length ? (
        <button onClick={discovery.clearRecentlyViewed} type="button">
          Clear recently viewed
        </button>
      ) : null}
      <RecommendationGroup items={groups.trending} title="Trending now" />
      <RecommendationGroup items={groups.newArrivals} title="New arrivals" />
    </section>
  );
}

function RecommendationGroup({
  title,
  items,
}: {
  title: string;
  items: readonly ReturnType<typeof fixtureDiscoveryProducts>[number][];
}) {
  if (!items.length) return null;
  return (
    <div className={styles.recommendationGroup}>
      <h3>{title}</h3>
      <ul className={styles.recommendationGrid}>
        {items.map((item) => (
          <li key={item.product.id}>
            <Link href={`/products/${item.product.slug}`}>
              <div className={styles.recommendationMedia}>
                <CatalogueProductMedia media={item.product.media[0]} />
              </div>
              <span className={styles.recommendationCopy}>
                <strong>{item.product.title}</strong>
                <span>{item.product.category.title}</span>
                <span>{item.product.price.label}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ComparisonBoundary({
  products,
  enabled,
}: {
  products: readonly CatalogueProduct[];
  enabled: boolean;
}) {
  return (
    <DiscoveryScope enabled={enabled}>
      <ComparisonTable products={products} />
    </DiscoveryScope>
  );
}

function ComparisonTable({
  products,
}: {
  products: readonly CatalogueProduct[];
}) {
  const discovery = useDiscovery();
  const cms = useProductCMS();
  const items = useMemo(
    () =>
      cms.enabled
        ? cmsDiscoveryProducts(
            cms.content.products,
            cms.content.categories,
            cms.content.collections,
          )
        : fixtureDiscoveryProducts(products),
    [cms.content, cms.enabled, products],
  );
  const selected = discovery.state.comparison
    .map((id) => items.find((item) => item.product.id === id))
    .filter((item): item is (typeof items)[number] => Boolean(item));
  if (!selected.length) {
    return (
      <div
        aria-label="Product comparison"
        className={styles.empty}
        role="region"
      >
        <h2>No products selected</h2>
        <p role="status">
          Add up to four products from the catalogue or a product page.
        </p>
        <Link href="/products">Browse products</Link>
      </div>
    );
  }
  const rows = [
    ["Price", ...selected.map((item) => item.product.price.label)],
    [
      "Material",
      ...selected.map((item) => item.product.purity.replaceAll("_", " ")),
    ],
    ["Category", ...selected.map((item) => item.product.category.title)],
    ["Collection", ...selected.map((item) => item.collectionName)],
    [
      "Wholesale",
      ...selected.map((item) => (item.wholesale ? "Available" : "Not shown")),
    ],
    ["Featured", ...selected.map((item) => (item.featured ? "Yes" : "No"))],
    ["Trending", ...selected.map((item) => (item.trending ? "Yes" : "No"))],
    [
      "New arrival",
      ...selected.map((item) => (item.newArrival ? "Yes" : "No")),
    ],
  ];
  return (
    <div className={styles.comparison}>
      <div className={styles.compareBar}>
        <span>{selected.length} of 4 products</span>
        <button onClick={discovery.clearComparison} type="button">
          Clear comparison
        </button>
      </div>
      <div
        className={styles.tableScroll}
        role="region"
        aria-label="Product comparison"
        tabIndex={0}
      >
        <div
          className={styles.comparisonMatrix}
          data-columns={selected.length}
        >
          <section
            aria-label="Compared product summaries"
            className={styles.compareCardsRow}
          >
            <div className={styles.compareCardsLead} aria-hidden="true">
              Compared products
            </div>
          {selected.map((item) => (
              <article
                className={styles.compareProductCard}
                key={item.product.id}
              >
              <div className={styles.compareProductMedia}>
                <CatalogueProductMedia media={item.product.media[0]} />
              </div>
              <div className={styles.compareProductSummary}>
                <Link
                  className={styles.compareProductName}
                  href={`/products/${item.product.slug}`}
                >
                  {item.product.title}
                </Link>
                <span className={styles.compareProductPrice}>
                  {item.product.price.label}
                </span>
                <div
                  aria-label={`${item.product.title} classification`}
                  className={styles.compareProductBadges}
                >
                  <span>{item.product.category.title}</span>
                  <span>{item.collectionName}</span>
                  <span>{item.product.purity.replaceAll("_", " ")}</span>
                </div>
                <button
                  aria-label={`Remove ${item.product.title} from comparison`}
                  className={styles.compareRemove}
                  onClick={() => discovery.removeComparison(item.product.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>
              </article>
          ))}
          </section>
          <table>
            <caption>Browser-local simulated product comparison</caption>
            <thead>
              <tr>
                <th className={styles.attributeHeading} scope="col">
                  Attribute
                </th>
                {selected.map((item) => (
                  <th key={item.product.id} scope="col">
                    <Link
                      className={styles.compareTableProductName}
                      href={`/products/${item.product.slug}`}
                    >
                      {item.product.title}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, ...values]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {values.map((value, index) => (
                    <td key={`${label}-${selected[index].product.id}`}>
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
