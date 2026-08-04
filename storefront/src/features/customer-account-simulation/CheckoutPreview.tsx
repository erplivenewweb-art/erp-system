"use client";

import Link from "next/link";
import { Container, Section, Stack } from "@/components/layout";
import { Breadcrumb } from "@/components/navigation";
import {
  formatSimulatedPrice,
  useCustomerIntent,
} from "@/features/customer-intent";
import { checkoutReadiness } from "./domain";
import { useCustomerAccount } from "./CustomerAccountProvider";
import { AccountSimulationNotice } from "./SimulationNotice";
import type { DeliveryOptionId, PaymentPreviewId } from "./types";
import styles from "./CustomerAccount.module.css";

const deliveryOptions: readonly {
  id: DeliveryOptionId;
  name: string;
  description: string;
  amountMinor: number;
}[] = [
  {
    id: "standard",
    name: "Standard delivery",
    description: "Illustrative 5–7 day timeline. No courier booking occurs.",
    amountMinor: 0,
  },
  {
    id: "priority",
    name: "Priority delivery",
    description: "Illustrative 2–4 day timeline. No live rate is calculated.",
    amountMinor: 25000,
  },
];

const paymentOptions: readonly {
  id: PaymentPreviewId;
  name: string;
  description: string;
}[] = [
  {
    id: "upi-preview",
    name: "UPI — preview only",
    description: "No UPI ID or PIN is collected.",
  },
  {
    id: "card-preview",
    name: "Card — preview only",
    description: "No card number, expiry, or CVV is collected.",
  },
];

export function SimulationCheckoutPage() {
  const account = useCustomerAccount();
  const intent = useCustomerIntent();
  const readiness = checkoutReadiness(
    intent.cartItems,
    account.session,
    account.profile,
    account.addresses,
    account.checkout,
  );
  const selectedDelivery = deliveryOptions.find(
    (item) => item.id === account.checkout.deliveryOption,
  );
  const estimatedTotal =
    intent.totals.subtotalMinor + (selectedDelivery?.amountMinor ?? 0);

  return (
    <Section>
      <Container>
        <Stack gap="lg">
          <Breadcrumb
            items={[
              { href: "/", label: "Home" },
              { href: "/cart", label: "Cart" },
              { label: "Checkout preview" },
            ]}
          />
          <div className={styles.pageHeader}>
            <p className={styles.eyebrow}>Checkout readiness simulation</p>
            <h1>Prepare a simulated review</h1>
            <p>
              This experience validates local intent only. It cannot place an
              order or process a payment.
            </p>
          </div>
          <AccountSimulationNotice
            persistenceStatus={account.persistenceStatus}
          />
          <nav aria-label="Checkout preview progress">
            <ol className={styles.progress}>
              {[
                "Customer",
                "Address",
                "Delivery",
                "Payment preview",
                "Review",
              ].map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </nav>
          {!account.enabled ? (
            <div className={styles.empty} role="alert">
              <h2>Checkout simulation is unavailable</h2>
              <p>No backend fallback or production execution is attempted.</p>
              <Link href="/cart">Return to cart</Link>
            </div>
          ) : !intent.hydrated || !account.hydrated ? (
            <p role="status">Restoring local checkout preview…</p>
          ) : intent.cartItems.length === 0 ? (
            <div className={styles.empty} role="status">
              <h2>Your simulated cart is empty</h2>
              <p>
                Add a fictional catalogue product before reviewing checkout.
              </p>
              <div className={styles.inlineActions}>
                <Link className={styles.primaryAction} href="/products">
                  Return to products
                </Link>
                <Link className={styles.secondaryAction} href="/cart">
                  Return to cart
                </Link>
              </div>
            </div>
          ) : (
            <div className={styles.checkoutGrid}>
              <div className={styles.page}>
                <section className={styles.panel}>
                  <h2>1. Customer or guest</h2>
                  {account.session ? (
                    <p>
                      Selected:{" "}
                      {account.session.status === "guest"
                        ? "Simulated guest"
                        : (account.profile?.displayName ??
                          "Simulated customer profile incomplete")}
                    </p>
                  ) : (
                    <p>No customer path selected.</p>
                  )}
                  <Link href="/account/sign-in">Choose customer path</Link>
                </section>
                <section className={styles.panel}>
                  <h2>2. Delivery address</h2>
                  {account.addresses.length ? (
                    <fieldset className={styles.choiceGroup}>
                      <legend>Select a simulated address</legend>
                      {account.addresses.map((address) => (
                        <label className={styles.choice} key={address.id}>
                          <input
                            checked={account.checkout.addressId === address.id}
                            name="checkout-address"
                            onChange={() =>
                              account.setCheckout({ addressId: address.id })
                            }
                            type="radio"
                          />
                          <span>
                            <strong>
                              {address.label}
                              {address.isDefault ? " · Default" : ""}
                            </strong>
                            <br />
                            {address.addressLine1}, {address.city},{" "}
                            {address.postalCode}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <p>No valid simulated address exists.</p>
                  )}
                  <Link href="/account/addresses">Manage local addresses</Link>
                </section>
                <section className={styles.panel}>
                  <h2>3. Delivery method preview</h2>
                  <fieldset className={styles.choiceGroup}>
                    <legend>Choose an illustrative delivery method</legend>
                    {deliveryOptions.map((option) => (
                      <label className={styles.choice} key={option.id}>
                        <input
                          checked={
                            account.checkout.deliveryOption === option.id
                          }
                          name="delivery-preview"
                          onChange={() =>
                            account.setCheckout({
                              deliveryOption: option.id,
                            })
                          }
                          type="radio"
                        />
                        <span>
                          <strong>{option.name}</strong>
                          <br />
                          {option.description}
                          <br />
                          {option.amountMinor
                            ? `${formatSimulatedPrice(option.amountMinor)} simulated`
                            : "No simulated delivery charge"}
                        </span>
                      </label>
                    ))}
                    <label className={styles.choice}>
                      <input disabled name="delivery-preview" type="radio" />
                      <span>
                        <strong>Store pickup — unavailable</strong>
                        <br />
                        Pickup eligibility is not configured.
                      </span>
                    </label>
                  </fieldset>
                </section>
                <section className={styles.panel}>
                  <h2>4. Payment method preview</h2>
                  <p>
                    No payment will be processed. Payment services are not
                    enabled. Do not enter real financial information.
                  </p>
                  <fieldset className={styles.choiceGroup}>
                    <legend>Choose a non-functional payment preview</legend>
                    {paymentOptions.map((option) => (
                      <label className={styles.choice} key={option.id}>
                        <input
                          checked={
                            account.checkout.paymentPreview === option.id
                          }
                          name="payment-preview"
                          onChange={() =>
                            account.setCheckout({
                              paymentPreview: option.id,
                            })
                          }
                          type="radio"
                        />
                        <span>
                          <strong>{option.name}</strong>
                          <br />
                          {option.description}
                        </span>
                      </label>
                    ))}
                    {[
                      "Cash on delivery — eligibility not configured",
                      "Bank transfer — unavailable",
                      "Pay at store — unavailable",
                    ].map((label) => (
                      <label className={styles.choice} key={label}>
                        <input disabled name="payment-preview" type="radio" />
                        <span>{label}</span>
                      </label>
                    ))}
                  </fieldset>
                </section>
                <section className={styles.panel}>
                  <h2>5. Review acknowledgement</h2>
                  <label className={styles.choice}>
                    <input
                      checked={account.checkout.acknowledged}
                      onChange={(event) =>
                        account.setCheckout({
                          acknowledged: event.target.checked,
                        })
                      }
                      type="checkbox"
                    />
                    <span>
                      I understand this is a simulation and no payment, order,
                      reservation, shipment, or invoice will be created.
                    </span>
                  </label>
                </section>
              </div>
              <aside
                aria-label="Simulated order summary"
                className={styles.summary}
              >
                <p className={styles.eyebrow}>Preview only</p>
                <h2>Order summary</h2>
                <ul className={styles.summaryItems}>
                  {intent.cartItems.map((item) => (
                    <li key={item.key}>
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span>
                        {formatSimulatedPrice(
                          item.unitPriceMinor * item.quantity,
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <dl>
                  <div>
                    <dt>Cart subtotal</dt>
                    <dd>{formatSimulatedPrice(intent.totals.subtotalMinor)}</dd>
                  </div>
                  <div>
                    <dt>Delivery preview</dt>
                    <dd>
                      {selectedDelivery
                        ? formatSimulatedPrice(selectedDelivery.amountMinor)
                        : "Not selected"}
                    </dd>
                  </div>
                  <div>
                    <dt>Tax</dt>
                    <dd>Unavailable</dd>
                  </div>
                  <div className={styles.total}>
                    <dt>Estimated preview total</dt>
                    <dd>{formatSimulatedPrice(estimatedTotal)}</dd>
                  </div>
                </dl>
                <h2>Readiness checklist</h2>
                <p>
                  Status:{" "}
                  {readiness.status === "ready-for-preview"
                    ? "Ready for simulated review"
                    : readiness.status.replaceAll("-", " ")}
                </p>
                <ul className={styles.readinessList}>
                  {readiness.checks.map((check) => (
                    <li key={check.id}>
                      <span aria-hidden="true">
                        {check.complete ? "✓" : "○"}
                      </span>
                      <span>{check.label}</span>
                    </li>
                  ))}
                </ul>
                <button
                  aria-describedby="order-disabled-explanation"
                  className={styles.secondaryAction}
                  disabled
                  type="button"
                >
                  Order placement not enabled
                </button>
                <p id="order-disabled-explanation">
                  No payment will occur. No order will be created. No stock will
                  be reserved. No invoice will be generated.
                </p>
              </aside>
            </div>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
