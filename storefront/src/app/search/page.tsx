import type { Metadata } from "next";
import { Container, Section, Stack } from "@/components/layout";
import { Breadcrumb } from "@/components/navigation";
import { LinkButton } from "@/components/ui";
import { ProductGrid, products } from "@/features/catalog";
import styles from "@/features/catalog/Catalog.module.css";

export const metadata: Metadata = { title: "Search catalogue preview", description: "Static search result and empty-state shells.", robots: { index: false, follow: true } };
export default function SearchPage() { return <><Section><Container><Stack gap="lg"><Breadcrumb items={[{ href: "/", label: "Home" }, { label: "Search" }]} /><h1>Search the future catalogue</h1><p className={styles.lede}>Search is not connected in this static phase. These states demonstrate the future presentation.</p><div className={styles.empty} role="status"><h2>No search submitted</h2><p>Try a future suggestion such as Silver Sankha, Pola or ceremonial pair.</p><LinkButton href="/shop">Browse all product shells</LinkButton></div></Stack></Container></Section><Section><Container><Stack gap="lg"><h2>Suggested result state</h2><ProductGrid products={products.slice(0, 3)} title="Suggested product results" /></Stack></Container></Section></>; }
