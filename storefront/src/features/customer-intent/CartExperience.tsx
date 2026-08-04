"use client";

import Link from "next/link";
import { Breadcrumb } from "@/components/navigation";
import { Container, Section, Stack } from "@/components/layout";
import {
  SimulationProductCard,
  developmentProducts,
} from "@/features/catalogue-simulation";
import { formatSimulatedPrice } from "./domain";
import { CartIntentItem } from "./IntentItem";
import { useCustomerIntent } from "./CustomerIntentProvider";
import styles from "./CustomerIntent.module.css";
import { useState } from "react";

export function SimulationCartPage() {
  const { cartItems, clearCart, totals, hydrated, persistenceStatus, enabled } =
    useCustomerIntent();
  const [confirmClear, setConfirmClear] = useState(false);
  const suggestions = developmentProducts
    .filter(
      (product) => !cartItems.some((item) => item.productId === product.id),
    )
    .slice(0, 3);

  return (
    <>
      <Section>
        <Container>
          <Stack gap="lg">
            <Breadcrumb
              items={[{ href: "/", label: "Home" }, { label: "Cart" }]}
            />
            <div className={styles.pageHeader}>
              <p className={styles.eyebrow}>Customer intent simulation</p>
              <h1>Your simulated cart</h1>
              <p>
                Review fictional catalogue selections stored only in this
                development browser.
              </p>
            </div>
            <SimulationStatus
              enabled={enabled}
              hydrated={hydrated}
              persistenceStatus={persistenceStatus}
            />
          </Stack>
        </Container>
      </Section>
      <Section>
        <Container>
          {!hydrated ? (
            <div className={styles.loadingState} role="status">
              Restoring development cart…
            </div>
          ) : cartItems.length ? (
            <div className={styles.cartLayout}>
              <div className={styles.cartList}>
                {cartItems.map((item) => (
                  <CartIntentItem item={item} key={item.key} />
                ))}
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
                    <button
                      onClick={() => setConfirmClear(false)}
                      type="button"
                    >
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
              <CartSummary
                itemQuantity={totals.itemQuantity}
                subtotalMinor={totals.subtotalMinor}
              />
            </div>
          ) : (
            <div className={styles.emptyState} role="status">
              <span aria-hidden="true" className={styles.emptyMark}>
                Bag
              </span>
              <h2>Your simulated cart is empty</h2>
              <p>No personal data or commerce record is stored.</p>
              <Link className={styles.primaryAction} href="/products">
                Continue browsing
              </Link>
            </div>
          )}
        </Container>
      </Section>
      <Section>
        <Container>
          <Stack gap="lg">
            <h2>Suggested simulated pieces</h2>
            <div className={styles.discoveryGrid}>
              {suggestions.map((product) => (
                <SimulationProductCard key={product.id} product={product} />
              ))}
            </div>
          </Stack>
        </Container>
      </Section>
    </>
  );
}

function CartSummary({
  itemQuantity,
  subtotalMinor,
}: {
  itemQuantity: number;
  subtotalMinor: number;
}) {
  return (
    <aside aria-label="Simulated cart summary" className={styles.summary}>
      <p className={styles.eyebrow}>Development estimate</p>
      <h2>Cart summary</h2>
      <dl>
        <div>
          <dt>Items</dt>
          <dd>{itemQuantity}</dd>
        </div>
        <div>
          <dt>Subtotal</dt>
          <dd>{formatSimulatedPrice(subtotalMinor)}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd>Unavailable</dd>
        </div>
        <div>
          <dt>Shipping preview</dt>
          <dd>Not calculated</dd>
        </div>
        <div>
          <dt>Tax preview</dt>
          <dd>Not calculated</dd>
        </div>
        <div className={styles.estimatedTotal}>
          <dt>Estimated total</dt>
          <dd>{formatSimulatedPrice(subtotalMinor)}</dd>
        </div>
      </dl>
      <Link className={styles.primaryAction} href="/checkout">
        Preview checkout
      </Link>
      <button
        className={styles.disabledCheckout}
        disabled
        title="Order placement is not available"
        type="button"
      >
        Order placement is not enabled
      </button>
      <ul className={styles.boundaryList}>
        <li>Payments are not enabled.</li>
        <li>Orders are not created.</li>
        <li>Inventory is not reserved.</li>
        <li>This is a simulation-only preview.</li>
      </ul>
      <Link href="/products">Continue shopping</Link>
    </aside>
  );
}

function SimulationStatus({
  enabled,
  hydrated,
  persistenceStatus,
}: {
  enabled: boolean;
  hydrated: boolean;
  persistenceStatus: string;
}) {
  return (
    <p className={styles.simulationNotice} role="status">
      {enabled
        ? `Development cart · ${hydrated ? "ready" : "restoring"} · persistence ${persistenceStatus}`
        : "Customer-intent simulation is disabled outside development."}
    </p>
  );
}
