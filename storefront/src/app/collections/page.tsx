import type { Metadata } from "next";
import { Container, Section, Stack } from "@/components/layout";
import { Breadcrumb } from "@/components/navigation";
import { CollectionCard, collections } from "@/features/catalog";
import styles from "@/features/catalog/Catalog.module.css";

export const metadata: Metadata = { title: "Collections", description: "Browse static Silver Sankha, Pola, gift, custom-order and wholesale collection shells.", alternates: { canonical: "/collections" }, openGraph: { title: "Silver Jewellery Collections", description: "CMS-ready collection previews from Silver Sankha.", type: "website" } };
export default function CollectionsPage() { return <><Section><Container><Stack gap="lg"><Breadcrumb items={[{ href: "/", label: "Home" }, { label: "Collections" }]} /><span className={styles.eyebrow}>Collection index</span><h1>Collections shaped for considered discovery</h1><p className={styles.lede}>Every card is a static editorial shell awaiting approved copy, media and commerce publication.</p></Stack></Container></Section><Section><Container><div className={styles.cardGrid}>{collections.map((collection) => <CollectionCard collection={collection} key={collection.slug} />)}</div></Container></Section></>; }
