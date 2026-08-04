"use client";

import Link from "next/link";
import { Container, Section, Stack } from "@/components/layout";
import { Breadcrumb } from "@/components/navigation";
import { useCustomerIntent } from "@/features/customer-intent";
import { checkoutReadiness } from "./domain";
import { useCustomerAccount } from "./CustomerAccountProvider";
import { AccountSimulationNotice } from "./SimulationNotice";
import styles from "./CustomerAccount.module.css";

export function SimulationAccountDashboard() {
  const account = useCustomerAccount();
  const intent = useCustomerIntent();
  const readiness = checkoutReadiness(
    intent.cartItems,
    account.session,
    account.profile,
    account.addresses,
    account.checkout,
  );
  const greeting =
    account.profile?.firstName ||
    (account.session?.status === "guest" ? "Guest" : "Customer");

  return (
    <Section>
      <Container>
        <Stack gap="lg">
          <Breadcrumb
            items={[{ href: "/", label: "Home" }, { label: "Account" }]}
          />
          <div className={styles.pageHeader}>
            <p className={styles.eyebrow}>Customer account simulation</p>
            <h1>Hello, {greeting}</h1>
            <p>
              Review local profile, address, saved-product, and checkout
              readiness previews.
            </p>
          </div>
          <AccountSimulationNotice
            persistenceStatus={account.persistenceStatus}
          />
          {!account.session ? (
            <div className={styles.panel}>
              <h2>No simulated session selected</h2>
              <p>Start a fictional customer session or continue as a guest.</p>
              <Link className={styles.primaryAction} href="/account/sign-in">
                Open simulated sign in
              </Link>
            </div>
          ) : (
            <div className={styles.dashboardGrid}>
              <DashboardCard
                heading="Session"
                href="/account/sign-in"
                linkLabel="Change session"
              >
                <p>
                  {account.session.status === "guest"
                    ? "Simulated guest"
                    : "Simulated signed-in customer"}
                </p>
                <p>Identity is not verified.</p>
              </DashboardCard>
              <DashboardCard
                heading="Profile"
                href="/account/profile"
                linkLabel="Edit local profile"
              >
                <p>{account.profile?.displayName ?? "Profile not completed"}</p>
                <p>Completeness: {account.profile?.completeness ?? "empty"}</p>
              </DashboardCard>
              <DashboardCard
                heading="Addresses"
                href="/account/addresses"
                linkLabel="Manage addresses"
              >
                <p>{account.addresses.length} simulated addresses</p>
                <p>
                  {account.addresses.find((item) => item.isDefault)?.label ??
                    "No default address"}
                </p>
              </DashboardCard>
              <DashboardCard
                heading="Customer intent"
                href="/cart"
                linkLabel="Review cart"
              >
                <p>{intent.totals.itemQuantity} cart items</p>
                <p>{intent.wishlistItems.length} wishlist items</p>
              </DashboardCard>
              <DashboardCard
                heading="Checkout readiness"
                href="/checkout"
                linkLabel="Preview checkout"
              >
                <p>{readiness.status.replaceAll("-", " ")}</p>
                <p>Never a payment or order readiness claim.</p>
              </DashboardCard>
              <DashboardCard
                heading="Shopping preference"
                href="/account/profile"
                linkLabel="Update preference"
              >
                <p>
                  {account.profile?.shoppingPreference === "wholesale-interest"
                    ? "Wholesale interest"
                    : "Retail"}
                </p>
              </DashboardCard>
            </div>
          )}
          <div className={styles.panel}>
            <h2>Order history</h2>
            <p>
              Order history will appear after real commerce services are
              enabled.
            </p>
            <p>No orders have been created.</p>
          </div>
          <div className={styles.actionGrid}>
            <button
              className={styles.secondaryAction}
              disabled={!account.enabled || !account.session}
              onClick={account.clearSession}
              type="button"
            >
              Simulated sign out
            </button>
            <button
              className={styles.dangerAction}
              disabled={!account.enabled}
              onClick={() => {
                account.resetAccount();
                intent.clearCart();
                intent.clearWishlist();
              }}
              type="button"
            >
              Clear all local simulation data
            </button>
          </div>
        </Stack>
      </Container>
    </Section>
  );
}

function DashboardCard({
  children,
  heading,
  href,
  linkLabel,
}: {
  children: React.ReactNode;
  heading: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <article className={styles.card}>
      <h2>{heading}</h2>
      {children}
      <Link href={href}>{linkLabel}</Link>
    </article>
  );
}
