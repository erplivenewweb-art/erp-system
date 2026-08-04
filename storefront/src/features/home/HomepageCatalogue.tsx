"use client";

import Link from "next/link";
import { SimulationProductCard } from "@/features/catalogue-simulation";
import {
  homepageProductGroups,
  useProductCMS,
} from "@/features/product-cms-simulation";
import { homeContent } from "./content";
import styles from "./HomePage.module.css";

export function HomepageCatalogue({
  newArrivals,
  trending,
}: {
  newArrivals?: { enabled: boolean; title: string; description: string };
  trending?: { enabled: boolean; title: string; description: string };
} = {}) {
  const productCMS = useProductCMS();
  const projected = homepageProductGroups(
    productCMS.content.products,
    productCMS.content.categories,
  );
  const groups = [
    {
      enabled: true,
      eyebrow: "Featured products",
      title: "Featured forms selected in the development product CMS.",
      description:
        "Browser-local merchandising with no inventory or publication service.",
      products: projected.featured,
    },
    {
      enabled: trending?.enabled ?? true,
      eyebrow: "Trending now",
      title: trending?.title ?? homeContent.products.title,
      description: trending?.description ?? homeContent.products.description,
      products: projected.trending,
    },
    {
      enabled: newArrivals?.enabled ?? true,
      eyebrow: "New arrivals",
      title:
        newArrivals?.title ??
        "Fresh expressions in the development collection.",
      description:
        newArrivals?.description ??
        "New labels are deterministic presentation data, never live inventory.",
      products: projected.newArrivals,
    },
    {
      enabled: true,
      eyebrow: "Best sellers",
      title: "Customer-favourite storytelling, safely simulated.",
      description:
        "A development-only merchandising order with no sales-history connection.",
      products: projected.bestSellers,
    },
  ];
  return (
    <>
      {groups
        .filter((group) => group.enabled && group.products.length)
        .map((group, index) => (
          <section
            className={`${styles.section} ${index % 2 ? styles.subtleSection : ""}`}
            key={group.eyebrow}
          >
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>{group.eyebrow}</p>
              <h2>{group.title}</h2>
              <p>{group.description}</p>
            </div>
            <div className={styles.productGrid}>
              {group.products.map((product) => (
                <SimulationProductCard key={product.id} product={product} />
              ))}
            </div>
            <Link className={styles.textAction} href="/products">
              Explore the complete simulated catalogue
            </Link>
            {index === 0 ? (
              <p className={styles.syntheticNote}>
                Synthetic homepage product shells. No live retail price,
                wholesale price or stock is shown.
              </p>
            ) : null}
          </section>
        ))}
    </>
  );
}
