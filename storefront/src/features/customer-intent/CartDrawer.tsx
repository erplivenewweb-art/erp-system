"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/icons";
import { formatSimulatedPrice } from "./domain";
import { CartIntentItem } from "./IntentItem";
import { useCustomerIntent } from "./CustomerIntentProvider";
import styles from "./CustomerIntent.module.css";

export function CartDrawer() {
  const { cartItems, cartOpen, closeCart, clearCart, totals } =
    useCustomerIntent();
  const [confirmClear, setConfirmClear] = useState(false);
  const titleId = useId();
  const drawerRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    if (cartOpen && !drawer.open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      drawer.showModal();
      drawer.querySelector<HTMLElement>("button, a[href]")?.focus();
    } else if (!cartOpen && drawer.open) {
      drawer.close();
    }
  }, [cartOpen]);

  function finishClose() {
    setConfirmClear(false);
    closeCart();
    returnFocusRef.current?.focus();
  }

  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      finishClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], input:not([disabled])",
      ),
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      aria-labelledby={titleId}
      className={styles.cartDrawer}
      onCancel={(event) => {
        event.preventDefault();
        finishClose();
      }}
      onClose={() => returnFocusRef.current?.focus()}
      onKeyDown={trapFocus}
      ref={drawerRef}
    >
      <div className={styles.drawerHeader}>
        <div>
          <p className={styles.eyebrow}>Development preview</p>
          <h2 id={titleId}>Your simulated cart</h2>
        </div>
        <button
          aria-label="Close simulated cart"
          onClick={finishClose}
          type="button"
        >
          <Icon name="close" />
        </button>
      </div>
      <p className={styles.simulationNotice}>
        Cart is for development preview only. No order or reservation is
        created.
      </p>
      {cartItems.length ? (
        <>
          <div className={styles.drawerList}>
            {cartItems.map((item) => (
              <CartIntentItem compact item={item} key={item.key} />
            ))}
          </div>
          <div className={styles.drawerSummary}>
            <p>
              <span>Simulated subtotal</span>
              <strong>{formatSimulatedPrice(totals.subtotalMinor)}</strong>
            </p>
            <Link
              className={styles.primaryAction}
              href="/cart"
              onClick={finishClose}
            >
              View cart
            </Link>
            <Link
              className={styles.primaryAction}
              href="/checkout"
              onClick={finishClose}
            >
              Preview checkout
            </Link>
            <button
              className={styles.disabledCheckout}
              disabled
              title="Order placement is not available"
              type="button"
            >
              Order placement unavailable
            </button>
            {confirmClear ? (
              <div className={styles.confirmActions}>
                <button
                  onClick={() => {
                    clearCart();
                    setConfirmClear(false);
                  }}
                  type="button"
                >
                  Confirm clear cart
                </button>
                <button onClick={() => setConfirmClear(false)} type="button">
                  Keep items
                </button>
              </div>
            ) : (
              <button
                className={styles.textAction}
                onClick={() => setConfirmClear(true)}
                type="button"
              >
                Clear cart
              </button>
            )}
          </div>
        </>
      ) : (
        <div className={styles.emptyState} role="status">
          <span aria-hidden="true" className={styles.emptyMark}>
            Bag
          </span>
          <h3>Your simulated cart is empty</h3>
          <p>Explore the development catalogue to add a fictional piece.</p>
          <Link
            className={styles.primaryAction}
            href="/products"
            onClick={finishClose}
          >
            Continue shopping
          </Link>
        </div>
      )}
    </dialog>
  );
}
