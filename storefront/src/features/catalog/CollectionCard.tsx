import Link from "next/link";
import type { CollectionFixture } from "./types";
import { CatalogueMedia } from "./CatalogueMedia";
import styles from "./Catalog.module.css";

export function CollectionCard({ collection }: { collection: CollectionFixture }) {
  return <article className={styles.collectionCard}><CatalogueMedia media={collection.media} /><div className={styles.cardBody}><span className={styles.eyebrow}>{collection.eyebrow}</span><h2><Link className={styles.cardLink} href={`/collections/${collection.slug}`}>{collection.name}</Link></h2><p>{collection.description}</p></div></article>;
}
