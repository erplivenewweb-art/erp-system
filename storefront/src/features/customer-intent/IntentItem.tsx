"use client";

import Link from "next/link";
import type { CartItem, WishlistItem } from "./types";
import { formatSimulatedPrice } from "./domain";
import { QuantityControl } from "./QuantityControl";
import { useCustomerIntent } from "./CustomerIntentProvider";
import styles from "./CustomerIntent.module.css";

export function CartIntentItem({
  item,
  compact = false,
}: {
  item: CartItem;
  compact?: boolean;
}) {
  const { removeFromCart } = useCustomerIntent();
  return (
    <article className={compact ? styles.drawerItem : styles.cartItem}>
      <IntentMedia label={item.imageLabel} />
      <div className={styles.itemDetails}>
        <h2>
          <Link href={`/products/${item.slug}`}>{item.name}</Link>
        </h2>
        <p>
          {item.category}
          {item.size ? ` · Size ${item.size}` : ""}
        </p>
        <p>{formatSimulatedPrice(item.unitPriceMinor)} simulated each</p>
        <QuantityControl
          itemKey={item.key}
          name={item.name}
          quantity={item.quantity}
        />
        <button
          aria-label={`Remove ${item.name} from simulated cart`}
          className={styles.textAction}
          onClick={() => removeFromCart(item.key)}
          type="button"
        >
          Remove
        </button>
      </div>
      <p className={styles.lineTotal}>
        {formatSimulatedPrice(item.unitPriceMinor * item.quantity)}
      </p>
    </article>
  );
}

export function WishlistIntentItem({ item }: { item: WishlistItem }) {
  const { moveWishlistToCart, removeFromWishlist } = useCustomerIntent();
  return (
    <article className={styles.wishlistCard}>
      <IntentMedia label={item.imageLabel} />
      <div className={styles.itemDetails}>
        <p className={styles.eyebrow}>{item.category}</p>
        <h2>
          <Link href={`/products/${item.slug}`}>{item.name}</Link>
        </h2>
        <p>
          {item.size ? `Size ${item.size}` : "Presentation size not specified"}
          {item.weight ? ` · ${item.weight}` : ""}
        </p>
        <p>{formatSimulatedPrice(item.unitPriceMinor)} simulated</p>
        <p>{item.availability.replaceAll("_", " ")}</p>
        <div className={styles.inlineActions}>
          <button
            aria-label="Add to simulated cart"
            className={styles.primaryAction}
            disabled={item.availability === "OUT_OF_STOCK"}
            onClick={() => moveWishlistToCart(item.key)}
            type="button"
          >
            Move to simulated cart
          </button>
          <button
            aria-label={`Remove ${item.name} from development wishlist`}
            className={styles.textAction}
            onClick={() => removeFromWishlist(item.key)}
            type="button"
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}

function IntentMedia({ label }: { label: string }) {
  return (
    <div aria-label={label} className={styles.intentMedia} role="img">
      <span aria-hidden="true">SS</span>
      <small>Development placeholder</small>
    </div>
  );
}
