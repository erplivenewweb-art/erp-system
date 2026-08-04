"use client";

import { useState } from "react";
import type { CatalogueProduct } from "@/features/catalogue-simulation";
import styles from "@/features/catalogue-simulation/Catalogue.module.css";
import { ProductIntentActions } from "./ProductIntentActions";

export function ProductDetailIntent({
  product,
}: {
  product: CatalogueProduct;
}) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  return (
    <>
      <div className={styles.field}>
        <label htmlFor={`product-size-${product.id}`}>
          Select size for presentation
        </label>
        <select
          id={`product-size-${product.id}`}
          onChange={(event) => setVariantId(event.target.value)}
          value={variantId}
        >
          {product.variants.map((variant) => (
            <option
              disabled={variant.availability === "OUT_OF_STOCK"}
              key={variant.id}
              value={variant.id}
            >
              {variant.size} · {variant.weight}
              {variant.availability === "OUT_OF_STOCK" ? " · unavailable" : ""}
            </option>
          ))}
        </select>
      </div>
      <ProductIntentActions product={product} variantId={variantId} />
    </>
  );
}
