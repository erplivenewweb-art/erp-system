import type { ProductFixture } from "@/features/catalog";
import styles from "./Product.module.css";

export function ProductSpecification({ product }: { product: ProductFixture }) {
  const rows = [["Purity", product.facts.purity], ["Weight", product.facts.weight], ["Size", product.facts.size], ["Material", product.facts.material], ["Manufacturing", product.facts.manufacturing]];
  return <table className={styles.specification}><caption>Product specifications</caption><tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table>;
}
