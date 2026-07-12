import type { Metadata } from "next";
import { Container, Section, Stack } from "@/components/layout";
import { Breadcrumb } from "@/components/navigation";
import { products } from "@/features/catalog";
import styles from "@/features/catalog/Catalog.module.css";

export const metadata: Metadata = { title: "Compare product shells", description: "Static product comparison presentation.", robots: { index: false, follow: true } };
export default function ComparePage() { const selected = products.slice(0, 2); const rows = [["Product", ...selected.map((item) => item.name)], ["Purity", ...selected.map((item) => item.facts.purity)], ["Weight", ...selected.map((item) => item.facts.weight)], ["Size", ...selected.map((item) => item.facts.size)], ["Price", ...selected.map((item) => item.priceLabel)]]; return <Section><Container><Stack gap="lg"><Breadcrumb items={[{ href: "/", label: "Home" }, { href: "/shop", label: "Shop" }, { label: "Compare" }]} /><h1>Compare product information</h1><p className={styles.lede}>A static CMS-ready shell. Selection and persistence are not connected.</p><div role="region" aria-label="Product comparison" tabIndex={0}><table className={styles.comparison}><caption>Comparison of two synthetic catalogue fixtures</caption><tbody>{rows.map(([label, ...values]) => <tr key={label}><th scope="row">{label}</th>{values.map((value, index) => <td key={`${label}-${selected[index].slug}`}>{value}</td>)}</tr>)}</tbody></table></div></Stack></Container></Section>; }
