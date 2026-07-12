import { Breadcrumb } from "@/components/navigation";
import { Container, Section, Stack } from "@/components/layout";
import type { ProductFixture } from "./types";
import { FilterPanel } from "./FilterPanel";
import { ProductGrid } from "./ProductGrid";
import styles from "./Catalog.module.css";

export function ListingPage({ title, description, products, breadcrumb }: { title: string; description: string; products: readonly ProductFixture[]; breadcrumb: Array<{ href?: string; label: string }> }) {
  return <><Section><Container><Stack gap="lg"><Breadcrumb items={breadcrumb} /><div className={styles.heroCopy}><span className={styles.eyebrow}>Static catalogue</span><h1>{title}</h1><p className={styles.lede}>{description}</p></div></Stack></Container></Section><Section><Container><div className={styles.catalogueLayout}><FilterPanel /><div><div className={styles.resultHeader}><p>{products.length} synthetic presentation {products.length === 1 ? "item" : "items"}</p><p>Filters and sorting are UI only</p></div><ProductGrid products={products} /></div></div></Container></Section></>;
}
