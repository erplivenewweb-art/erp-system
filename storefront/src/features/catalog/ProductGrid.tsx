import type { ProductFixture } from "./types";
import { ProductCard } from "./ProductCard";
import styles from "./Catalog.module.css";

export function ProductGrid({ products, title = "Catalogue results" }: { products: readonly ProductFixture[]; title?: string }) {
  if (!products.length) return <div className={styles.empty} role="status"><h2>No published pieces yet</h2><p>This CMS-ready collection is awaiting approved retail content.</p></div>;
  return <div aria-label={title} className={styles.cardGrid}>{products.map((product) => <ProductCard key={product.slug} product={product} />)}</div>;
}
