"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { useCustomerIntent } from "./CustomerIntentProvider";
import styles from "./CustomerIntent.module.css";

export function IntentNavigationActions({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const { totals, wishlistItems, openCart, enabled } = useCustomerIntent();
  if (mobile) {
    return (
      <>
        <Link href="/wishlist" onClick={onNavigate}>
          <Icon name="heart" />
          Wishlist
          <CountBadge count={wishlistItems.length} label="wishlist" />
        </Link>
        <Link href="/cart" onClick={onNavigate}>
          <Icon name="cart" />
          Cart
          <CountBadge count={totals.itemQuantity} label="cart" />
        </Link>
      </>
    );
  }
  return (
    <>
      <Link
        aria-label={`Wishlist, ${wishlistItems.length} saved`}
        href="/wishlist"
      >
        <Icon name="heart" />
        <span>Wishlist</span>
        <CountBadge count={wishlistItems.length} label="wishlist" />
      </Link>
      <button
        aria-label={`Open simulated cart, ${totals.itemQuantity} items`}
        className={styles.navigationButton}
        disabled={!enabled}
        onClick={openCart}
        type="button"
      >
        <Icon name="cart" />
        <span>Cart</span>
        <CountBadge count={totals.itemQuantity} label="cart" />
      </button>
    </>
  );
}

function CountBadge({ count, label }: { count: number; label: string }) {
  return (
    <span
      aria-label={`${count} ${label} ${count === 1 ? "item" : "items"}`}
      className={styles.countBadge}
    >
      {count}
    </span>
  );
}
