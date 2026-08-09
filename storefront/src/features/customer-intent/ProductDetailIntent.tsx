"use client";

import { useState } from "react";
import {
  developmentProducts,
  type CatalogueProduct,
} from "@/features/catalogue-simulation";
import styles from "@/features/catalogue-simulation/Catalogue.module.css";
import { formatSimulatedPrice } from "./domain";
import { useCustomerIntent } from "./CustomerIntentProvider";
import { ProductIntentActions } from "./ProductIntentActions";
import { MAX_SIMULATED_QUANTITY, productToIntent } from "./types";
import intentStyles from "./CustomerIntent.module.css";

export function ProductDetailIntent({
  product,
}: {
  product: CatalogueProduct;
}) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const intent = useCustomerIntent();
  const bundle = [
    product,
    ...developmentProducts
      .filter((candidate) => candidate.id !== product.id)
      .toSorted(
        (left, right) =>
          Number(right.category.slug === product.category.slug) -
          Number(left.category.slug === product.category.slug),
      )
      .slice(0, 2),
  ];
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
      <div className={intentStyles.productQuantityRow}>
        <label htmlFor={`purchase-quantity-${product.id}`}>Quantity</label>
        <select
          id={`purchase-quantity-${product.id}`}
          onChange={(event) => setQuantity(Number(event.target.value))}
          value={quantity}
        >
          {Array.from({ length: MAX_SIMULATED_QUANTITY }, (_, index) => index + 1).map(
            (value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ),
          )}
        </select>
      </div>
      <ProductIntentActions
        product={product}
        quantity={quantity}
        showBuyNow
        variantId={variantId}
      />
      <section
        aria-labelledby={`bundle-title-${product.id}`}
        className={intentStyles.bundlePanel}
      >
        <div>
          <p className={intentStyles.eyebrow}>Deterministic simulation</p>
          <h2 id={`bundle-title-${product.id}`}>Frequently bought together</h2>
          <ul>
            {bundle.map((item) => (
              <li key={item.id}>
                <span>{item.title}</span>
                <strong>{item.price.label}</strong>
              </li>
            ))}
          </ul>
          <p>
            Combined preview: {formatSimulatedPrice(
              bundle.reduce((total, item) => total + Math.round(item.price.amount * 100), 0),
            )}
          </p>
        </div>
        <button
          className={intentStyles.bundleAction}
          onClick={() =>
            intent.addBundleToCart(bundle.map((item) => productToIntent(item)))
          }
          type="button"
        >
          Add all to simulated cart
        </button>
      </section>
    </>
  );
}
