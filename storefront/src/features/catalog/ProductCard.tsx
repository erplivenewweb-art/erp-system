import Link from "next/link";
import type { ProductFixture } from "./types";
import { CatalogueMedia } from "./CatalogueMedia";
import styles from "./Catalog.module.css";

export function ProductCard({ product }: { product: ProductFixture }) {
  return <article className={styles.productCard}>
    <CatalogueMedia media={product.gallery[0]} />
    <div className={styles.cardBody}>
      <span className={styles.badge}>{product.availability}</span>
      <h3><Link className={styles.cardLink} href={`/product/${product.slug}`}>{product.name}</Link></h3>
      <ul className={styles.facts} aria-label={`${product.name} summary`}><li>{product.facts.purity}</li><li>{product.facts.weight}</li><li>{product.facts.size}</li></ul>
      <p>{product.priceLabel}</p>
      <div className={styles.cardControls}><button className={styles.iconShell} type="button" aria-label={`Save ${product.name} for later`}>♡ Favorite</button><Link className={styles.iconShell} href={`/product/${product.slug}`}>Quick view</Link></div>
    </div>
  </article>;
}
