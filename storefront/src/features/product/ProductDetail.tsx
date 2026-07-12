import { Breadcrumb } from "@/components/navigation";
import { Container, Section, Stack } from "@/components/layout";
import { ProductGrid, products, type ProductFixture } from "@/features/catalog";
import { ProductGallery } from "./ProductGallery";
import { ProductSpecification } from "./ProductSpecification";
import { CareGuide, ManufacturingStory, PackagingStory, ProductEnquiryActions } from "./ProductSupport";
import styles from "./Product.module.css";

export function ProductDetail({ product }: { product: ProductFixture }) {
  const related = products.filter((item) => item.slug !== product.slug && (item.collection === product.collection || item.category === product.category)).slice(0, 3);
  return <><Section><Container><Stack gap="lg"><Breadcrumb items={[{ href: "/", label: "Home" }, { href: "/shop", label: "Shop" }, { label: product.name }]} /><div className={styles.detailGrid}><ProductGallery product={product} /><div className={styles.summary}><span className={styles.status}>{product.availability}</span><h1>{product.name}</h1><p>{product.description}</p><p className={styles.price}>{product.priceLabel}</p><dl className={styles.facts}><div className={styles.fact}><dt>Purity</dt><dd>{product.facts.purity}</dd></div><div className={styles.fact}><dt>Weight</dt><dd>{product.facts.weight}</dd></div><div className={styles.fact}><dt>Size</dt><dd>{product.facts.size}</dd></div></dl><ProductEnquiryActions /></div></div></Stack></Container></Section><Section><Container><Stack gap="lg"><h2>Details for considered decisions</h2><ProductSpecification product={product} /><CareGuide /><div className={styles.storyGrid}><ManufacturingStory /><PackagingStory /></div></Stack></Container></Section><Section><Container><Stack gap="lg"><h2>Related pieces</h2><ProductGrid products={related} title="Related products" /></Stack></Container></Section><Section><Container><div className={styles.notice}><h2>Recently viewed</h2><p>This privacy-conscious shell has no browser persistence or tracking.</p></div></Container></Section></>;
}
