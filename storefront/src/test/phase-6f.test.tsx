// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { metadata as accountMetadata } from "@/app/account/page";
import { metadata as addressMetadata } from "@/app/account/addresses/page";
import { metadata as profileMetadata } from "@/app/account/profile/page";
import { metadata as signInMetadata } from "@/app/account/sign-in/page";
import { metadata as checkoutMetadata } from "@/app/checkout/page";
import { developmentProducts } from "@/features/catalogue-simulation";
import {
  CUSTOMER_ACCOUNT_SCHEMA_VERSION,
  AccountNavigationAction,
  CustomerAccountProvider,
  SimulationAccountDashboard,
  SimulationAddressBookPage,
  SimulationCheckoutPage,
  SimulationProfilePage,
  SimulatedSignInPage,
  addAddress,
  checkoutReadiness,
  createGuestSession,
  createSignedInSession,
  deleteAddress,
  parsePersistedCustomerAccount,
  restoreCustomerAccount,
  setDefaultAddress,
  updateAddress,
  validateAddress,
  validateProfile,
} from "@/features/customer-account-simulation";
import {
  CustomerIntentProvider,
  CART_STORAGE_KEY,
  ProductIntentActions,
  addCartItem,
  productToIntent,
} from "@/features/customer-intent";

const now = "2026-01-02T00:00:00.000Z";
const validAddressInput = {
  label: "Home" as const,
  recipientName: "Asha Sen",
  phone: "9876543210",
  addressLine1: "12 Lake Road",
  city: "Kolkata",
  state: "West Bengal",
  postalCode: "700001",
  country: "India",
  isDefault: true,
};
const address = validateAddress(
  validAddressInput,
  "sim-address-1",
  now,
  now,
).value!;
const cartItem = addCartItem([], productToIntent(developmentProducts[0]))[0];

beforeEach(() => localStorage.clear());

describe("Phase 6F customer account domain", () => {
  it("creates local-only session identities and validates normalized profiles", () => {
    expect(createGuestSession(now)).toMatchObject({
      status: "guest",
      customerId: "sim-guest-current-browser",
    });
    expect(createSignedInSession(" ASHA@EXAMPLE.COM ", now)).toMatchObject({
      status: "simulated-signed-in",
      customerId: expect.stringMatching(/^sim-customer-/),
    });
    const profile = validateProfile(
      {
        firstName: "  Asha ",
        lastName: " Sen  ",
        email: " ASHA@EXAMPLE.COM ",
        phone: "+91 98765 43210",
        marketingPreference: false,
        shoppingPreference: "retail",
      },
      now,
      now,
    );
    expect(profile.value).toMatchObject({
      displayName: "Asha Sen",
      email: "asha@example.com",
      phone: "9876543210",
      completeness: "complete",
    });
    expect(
      validateProfile({
        firstName: "",
        lastName: "",
        email: "invalid",
        marketingPreference: false,
        shoppingPreference: "retail",
      }).valid,
    ).toBe(false);
  });

  it("rejects unsupported persistence versions and safely restores malformed JSON", () => {
    expect(
      parsePersistedCustomerAccount({
        version: CUSTOMER_ACCOUNT_SCHEMA_VERSION + 1,
        session: null,
        profile: null,
        addresses: [],
        checkout: { acknowledged: false },
      }),
    ).toBeNull();
    localStorage.setItem("silver-sankha-development-account-v1", "{broken");
    expect(restoreCustomerAccount(localStorage)).toEqual({
      status: "invalid",
      state: null,
    });
    expect(localStorage.length).toBe(0);
  });
});

describe("Phase 6F address domain", () => {
  it("adds, edits, defaults and reassigns a deleted default address", () => {
    const first = addAddress([], address);
    const secondAddress = validateAddress(
      {
        ...validAddressInput,
        label: "Work",
        addressLine1: "44 Park Street",
        isDefault: false,
      },
      "sim-address-2",
      now,
      now,
    ).value!;
    const second = addAddress(first, secondAddress);
    expect(second).toHaveLength(2);
    expect(addAddress(second, secondAddress)).toBe(second);
    expect(setDefaultAddress(second, "sim-address-2")[1].isDefault).toBe(true);
    const edited = updateAddress(second, {
      ...secondAddress,
      city: "Howrah",
    });
    expect(edited[1].city).toBe("Howrah");
    expect(deleteAddress(second, "sim-address-1")[0].isDefault).toBe(true);
  });

  it("rejects invalid addresses and enforces the maximum", () => {
    expect(
      validateAddress(
        { ...validAddressInput, phone: "123", postalCode: "000000" },
        "sim-address-1",
      ).valid,
    ).toBe(false);
    const five = Array.from({ length: 5 }, (_, index) => ({
      ...address,
      id: `sim-address-${index + 1}`,
      addressLine1: `${index + 10} Lake Road`,
      isDefault: index === 0,
    }));
    expect(
      addAddress(five, {
        ...address,
        id: "sim-address-6",
        addressLine1: "99 Lake Road",
      }),
    ).toBe(five);
  });
});

describe("Phase 6F checkout readiness", () => {
  const guest = createGuestSession(now);
  it("blocks an empty or unavailable cart", () => {
    expect(
      checkoutReadiness([], guest, null, [], { acknowledged: false }).status,
    ).toBe("blocked");
    expect(
      checkoutReadiness(
        [{ ...cartItem, availability: "OUT_OF_STOCK" }],
        guest,
        null,
        [address],
        {
          addressId: address.id,
          deliveryOption: "standard",
          paymentPreview: "upi-preview",
          acknowledged: true,
        },
      ).status,
    ).toBe("blocked");
  });

  it("stays incomplete until address, delivery and payment previews are selected", () => {
    expect(
      checkoutReadiness([cartItem], guest, null, [], {
        acknowledged: false,
      }).status,
    ).toBe("incomplete");
    expect(
      checkoutReadiness([cartItem], guest, null, [address], {
        addressId: address.id,
        deliveryOption: "standard",
        paymentPreview: "upi-preview",
        acknowledged: true,
      }).status,
    ).toBe("ready-for-preview");
  });
});

describe("Phase 6F simulation UI and metadata", () => {
  it("validates sign-in and supports the explicit guest path", async () => {
    const user = userEvent.setup();
    render(
      <CustomerAccountProvider enabled>
        <SimulatedSignInPage />
      </CustomerAccountProvider>,
    );
    await screen.findByText(/No account, password, OTP/i);
    await user.type(screen.getByLabelText("Email address"), "invalid");
    await user.click(
      screen.getByRole("button", {
        name: "Continue as simulated customer",
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid email address.",
    );
    await user.click(screen.getByRole("button", { name: "Continue as guest" }));
    expect(
      await screen.findByText(/Continuing as a simulated guest/i),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        JSON.parse(
          localStorage.getItem("silver-sankha-development-account-v1") ?? "{}",
        ).session,
      ).toMatchObject({ status: "guest" }),
    );
  });

  it("exposes account navigation and an accessible profile error summary", async () => {
    const user = userEvent.setup();
    render(
      <CustomerAccountProvider enabled>
        <AccountNavigationAction />
        <SimulationProfilePage />
      </CustomerAccountProvider>,
    );
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
      "href",
      "/account",
    );
    await user.click(
      await screen.findByRole("button", { name: "Save simulated profile" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Correct the profile fields",
    );
  });

  it("shows address validation without sending data", async () => {
    const user = userEvent.setup();
    render(
      <CustomerAccountProvider enabled>
        <SimulationAddressBookPage />
      </CustomerAccountProvider>,
    );
    await screen.findByText(/address book is empty/i);
    await user.click(
      screen.getByRole("button", { name: "Add simulated address" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Save simulated address" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Correct the highlighted/i,
    );
  });

  it("requires confirmation before deleting a local address", async () => {
    localStorage.setItem(
      "silver-sankha-development-account-v1",
      JSON.stringify({
        version: CUSTOMER_ACCOUNT_SCHEMA_VERSION,
        session: createGuestSession(now),
        profile: null,
        addresses: [address],
        checkout: { acknowledged: false, addressId: address.id },
      }),
    );
    const user = userEvent.setup();
    render(
      <CustomerAccountProvider enabled>
        <SimulationAddressBookPage />
      </CustomerAccountProvider>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Delete Home address" }),
    );
    expect(
      screen.getByRole("button", { name: "Confirm delete Home address" }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Confirm delete Home address" }),
    );
    expect(
      screen.getByRole("heading", {
        name: "Your simulated address book is empty",
      }),
    ).toBeVisible();
  });

  it("keeps checkout empty-state and production-disabled postures fail closed", async () => {
    const { rerender } = render(
      <CustomerIntentProvider enabled>
        <CustomerAccountProvider enabled>
          <SimulationCheckoutPage />
        </CustomerAccountProvider>
      </CustomerIntentProvider>,
    );
    expect(
      await screen.findByRole("heading", {
        name: "Your simulated cart is empty",
      }),
    ).toBeVisible();
    rerender(
      <CustomerIntentProvider enabled>
        <CustomerAccountProvider enabled={false}>
          <ProductIntentActions product={developmentProducts[0]} />
          <SimulationCheckoutPage />
        </CustomerAccountProvider>
      </CustomerIntentProvider>,
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Checkout simulation is unavailable/i),
      ).toBeVisible(),
    );
  });

  it("disables local account mutations outside simulation posture", () => {
    render(
      <CustomerIntentProvider enabled={false}>
        <CustomerAccountProvider enabled={false}>
          <SimulationAccountDashboard />
        </CustomerAccountProvider>
      </CustomerIntentProvider>,
    );
    expect(
      screen.getByRole("button", {
        name: "Clear all local simulation data",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Simulated sign out" }),
    ).toBeDisabled();
  });

  it("renders payment warnings and keeps final order placement disabled", async () => {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ version: 1, items: [cartItem] }),
    );
    localStorage.setItem(
      "silver-sankha-development-account-v1",
      JSON.stringify({
        version: CUSTOMER_ACCOUNT_SCHEMA_VERSION,
        session: createGuestSession(now),
        profile: null,
        addresses: [address],
        checkout: { acknowledged: false, addressId: address.id },
      }),
    );
    render(
      <CustomerIntentProvider enabled>
        <CustomerAccountProvider enabled>
          <SimulationCheckoutPage />
        </CustomerAccountProvider>
      </CustomerIntentProvider>,
    );
    expect(
      await screen.findByText(/No payment will be processed\./),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Order placement not enabled" }),
    ).toBeDisabled();
    expect(screen.getByText(/No stock will be reserved/i)).toBeVisible();
  });

  it("marks every private simulation route noindex and nofollow", () => {
    for (const metadata of [
      accountMetadata,
      addressMetadata,
      profileMetadata,
      signInMetadata,
      checkoutMetadata,
    ])
      expect(metadata.robots).toMatchObject({
        index: false,
        follow: false,
        nocache: true,
      });
  });
});
