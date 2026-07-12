"use client";

import { useState } from "react";
import { CatalogueMedia, type ProductFixture } from "@/features/catalog";
import styles from "./Product.module.css";

export function ProductGallery({ product }: { product: ProductFixture }) {
  const [selected, setSelected] = useState(0);
  return <div className={styles.gallery}><div aria-live="polite"><CatalogueMedia media={product.gallery[selected]} /></div><div aria-label={`${product.name} gallery views`} className={styles.thumbs} role="tablist">{product.gallery.map((media, index) => <button aria-label={`Show ${media.label}`} aria-selected={selected === index} className={styles.thumb} key={media.label} onClick={() => setSelected(index)} role="tab" type="button"><span className={styles.thumbPreview}>{media.label}</span></button>)}</div><p>Zoom, 360° and video media slots are reserved for future approved assets.</p></div>;
}
