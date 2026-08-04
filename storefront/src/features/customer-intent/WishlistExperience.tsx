"use client";

import Link from "next/link";
import { useState } from "react";
import { Container, Section, Stack } from "@/components/layout";
import { Breadcrumb } from "@/components/navigation";
import { WishlistIntentItem } from "./IntentItem";
import { useCustomerIntent } from "./CustomerIntentProvider";
import styles from "./CustomerIntent.module.css";

export function SimulationWishlistPage() {
  const { wishlistItems, clearWishlist, hydrated, persistenceStatus, enabled } =
    useCustomerIntent();
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <>
      <Section>
        <Container>
          <Stack gap="lg">
            <Breadcrumb
              items={[{ href: "/", label: "Home" }, { label: "Wishlist" }]}
            />
            <div className={styles.pageHeader}>
              <p className={styles.eyebrow}>Development-only persistence</p>
              <h1>Your development wishlist</h1>
              <p>
                Save fictional products locally without an account, database, or
                customer record.
              </p>
            </div>
            <p className={styles.simulationNotice} role="status">
              {enabled
                ? `${wishlistItems.length} saved ${wishlistItems.length === 1 ? "piece" : "pieces"} · persistence ${hydrated ? persistenceStatus : "restoring"}`
                : "Wishlist simulation is disabled outside development."}
            </p>
          </Stack>
        </Container>
      </Section>
      <Section>
        <Container>
          {!hydrated ? (
            <div className={styles.loadingState} role="status">
              Restoring development wishlist…
            </div>
          ) : wishlistItems.length ? (
            <Stack gap="lg">
              <div className={styles.wishlistGrid}>
                {wishlistItems.map((item) => (
                  <WishlistIntentItem item={item} key={item.key} />
                ))}
              </div>
              {confirmClear ? (
                <div className={styles.confirmActions}>
                  <button
                    onClick={() => {
                      clearWishlist();
                      setConfirmClear(false);
                    }}
                    type="button"
                  >
                    Confirm clear wishlist
                  </button>
                  <button onClick={() => setConfirmClear(false)} type="button">
                    Keep saved pieces
                  </button>
                </div>
              ) : (
                <button
                  className={styles.textAction}
                  onClick={() => setConfirmClear(true)}
                  type="button"
                >
                  Clear wishlist
                </button>
              )}
            </Stack>
          ) : (
            <div className={styles.emptyState} role="status">
              <span aria-hidden="true" className={styles.emptyMark}>
                Wish
              </span>
              <h2>Your development wishlist is empty</h2>
              <p>Saved simulated pieces will appear here on this browser.</p>
              <Link className={styles.primaryAction} href="/products">
                Continue browsing
              </Link>
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
