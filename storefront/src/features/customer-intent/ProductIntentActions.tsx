"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import type { CatalogueProduct } from "@/features/catalogue-simulation";
import { productToIntent } from "./types";
import { useCustomerIntent } from "./CustomerIntentProvider";
import styles from "./CustomerIntent.module.css";

export function ProductIntentActions({
  product,
  variantId,
  compact = false,
}: {
  product: CatalogueProduct;
  variantId?: string;
  compact?: boolean;
}) {
  const intent = useCustomerIntent();
  const [feedback, setFeedback] = useState("");
  const projection = productToIntent(product, variantId);
  const unavailable =
    projection.availability === "OUT_OF_STOCK" || !intent.enabled;
  const wishlisted = intent.isWishlisted(projection);

  function add() {
    const result = intent.addToCart(projection);
    setFeedback(
      result.status === "merged"
        ? `Quantity updated to ${result.quantity}.`
        : result.status === "maximum"
          ? "Maximum simulated quantity reached."
          : "Added to simulated cart.",
    );
  }

  return (
    <div className={compact ? styles.compactActions : styles.productActions}>
      <button
        aria-label={`Add ${product.title} to simulated cart`}
        className={styles.primaryAction}
        disabled={unavailable}
        onClick={add}
        type="button"
      >
        <Icon name="cart" />
        {projection.availability === "OUT_OF_STOCK"
          ? "Unavailable"
          : "Add to cart"}
      </button>
      <button
        aria-label={`${wishlisted ? "Remove" : "Save"} ${product.title} ${wishlisted ? "from" : "to"} development wishlist`}
        aria-pressed={wishlisted}
        className={styles.wishlistAction}
        disabled={!intent.enabled}
        onClick={() => intent.toggleWishlist(projection)}
        title={
          intent.enabled
            ? wishlisted
              ? "Remove from development wishlist"
              : "Save to development wishlist"
            : "Customer-intent simulation is available in development only"
        }
        type="button"
      >
        <Icon name="heart" />
        {compact ? null : wishlisted ? "Saved" : "Wishlist"}
      </button>
      {feedback ? (
        <span className={styles.feedback} role="status">
          {feedback}
        </span>
      ) : null}
    </div>
  );
}
