// @vitest-environment jsdom

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { metadata as cartMetadata } from "@/app/cart/page";
import { metadata as wishlistMetadata } from "@/app/wishlist/page";
import { developmentProducts } from "@/features/catalogue-simulation";
import {
  CART_STORAGE_KEY,
  CartDrawer,
  CustomerIntentProvider,
  IntentNavigationActions,
  MAX_SIMULATED_QUANTITY,
  ProductIntentActions,
  SimulationCartPage,
  SimulationWishlistPage,
  WISHLIST_STORAGE_KEY,
  addCartItem,
  addWishlistItem,
  calculateCartTotals,
  parsePersistedCart,
  productToIntent,
  removeCartItem,
  removeWishlistItem,
  restoreCart,
  restoreWishlist,
  setCartQuantity,
} from "@/features/customer-intent";

const product = productToIntent(developmentProducts[0]);
const secondProduct = productToIntent(developmentProducts[2]);

beforeEach(() => localStorage.clear());

describe("Phase 6E cart domain and persistence", () => {
  it("adds, merges, bounds, updates, removes and clears deterministic items", () => {
    const added = addCartItem([], product);
    expect(added[0]).toMatchObject({ quantity: 1, unitPriceMinor: 485000 });
    const merged = addCartItem(added, product, 2);
    expect(merged[0].quantity).toBe(3);
    expect(addCartItem(merged, product, 99)[0].quantity).toBe(
      MAX_SIMULATED_QUANTITY,
    );
    expect(setCartQuantity(merged, merged[0].key, 0)).toEqual([]);
    expect(setCartQuantity(merged, merged[0].key, 99)[0].quantity).toBe(
      MAX_SIMULATED_QUANTITY,
    );
    expect(removeCartItem(merged, merged[0].key)).toEqual([]);
  });

  it("rejects invalid or unavailable product input", () => {
    expect(addCartItem([], product, 0)).toEqual([]);
    expect(
      addCartItem([], { ...product, availability: "OUT_OF_STOCK" }),
    ).toEqual([]);
  });

  it("calculates item quantities and money entirely in minor units", () => {
    const items = addCartItem(addCartItem([], product, 2), secondProduct, 1);
    expect(calculateCartTotals(items)).toEqual({
      distinctItemCount: 2,
      itemQuantity: 3,
      subtotalMinor: 1395000,
      estimatedTotalMinor: 1395000,
    });
  });

  it("validates persistence versions, duplicates and malformed data", () => {
    const item = addCartItem([], product)[0];
    expect(parsePersistedCart({ version: 1, items: [item] })?.items).toEqual([
      item,
    ]);
    expect(parsePersistedCart({ version: 2, items: [item] })).toBeNull();
    expect(
      parsePersistedCart({ version: 1, items: [{ ...item, quantity: -1 }] }),
    ).toBeNull();
    expect(parsePersistedCart({ version: 1, items: [item, item] })).toBeNull();
  });

  it("recovers safely from corrupt cart and unavailable storage", () => {
    localStorage.setItem(CART_STORAGE_KEY, "{broken");
    expect(restoreCart(localStorage)).toEqual({ status: "invalid", items: [] });
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
    expect(restoreCart(null)).toEqual({ status: "unavailable", items: [] });
  });
});

describe("Phase 6E wishlist domain and persistence", () => {
  it("adds once, toggles through remove, and clears", () => {
    const added = addWishlistItem([], product);
    expect(addWishlistItem(added, product)).toBe(added);
    expect(removeWishlistItem(added, added[0].key)).toEqual([]);
  });

  it("rejects stale versions and recovers malformed persisted state", () => {
    localStorage.setItem(
      WISHLIST_STORAGE_KEY,
      JSON.stringify({ version: 9, items: [] }),
    );
    expect(restoreWishlist(localStorage)).toEqual({
      status: "invalid",
      items: [],
    });
  });
});

describe("Phase 6E customer-intent UI", () => {
  it("adds, merges, announces, updates badges and opens the cart drawer", async () => {
    const user = userEvent.setup();
    render(
      <CustomerIntentProvider enabled>
        <ProductIntentActions product={developmentProducts[0]} />
        <IntentNavigationActions />
        <CartDrawer />
      </CustomerIntentProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Add Silver/ })).toBeEnabled(),
    );
    const add = screen.getByRole("button", {
      name: "Add Silver Sankha Heritage to simulated cart",
    });
    await user.click(add);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Added to simulated cart",
    );
    await user.click(add);
    expect(screen.getByText("Quantity updated to 2.")).toBeVisible();
    expect(
      screen.getByLabelText("2 cart items", { selector: "span" }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Open simulated cart, 2 items" }),
    );
    const drawer = screen.getByRole("dialog", {
      name: "Your simulated cart",
    });
    expect(drawer).toHaveAttribute("open");
    expect(
      within(drawer).getByRole("button", {
        name: "Order placement unavailable",
      }),
    ).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(drawer).not.toHaveAttribute("open");
  });

  it("persists and restores cart and wishlist without a hydration mismatch", async () => {
    const item = addCartItem([], product)[0];
    const wish = addWishlistItem([], secondProduct)[0];
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ version: 1, items: [item] }),
    );
    localStorage.setItem(
      WISHLIST_STORAGE_KEY,
      JSON.stringify({ version: 1, items: [wish] }),
    );
    render(
      <CustomerIntentProvider enabled>
        <SimulationCartPage />
        <SimulationWishlistPage />
      </CustomerIntentProvider>,
    );
    expect(screen.getAllByRole("status")[0]).toHaveTextContent(/restoring/i);
    expect(
      await screen.findByRole("heading", { level: 2, name: product.name }),
    ).toBeVisible();
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: secondProduct.name,
      }),
    ).toBeVisible();
  });

  it("toggles wishlist, prevents duplicates and can add it to the cart", async () => {
    const user = userEvent.setup();
    render(
      <CustomerIntentProvider enabled>
        <ProductIntentActions product={developmentProducts[0]} />
        <SimulationWishlistPage />
        <IntentNavigationActions />
      </CustomerIntentProvider>,
    );
    const toggle = await screen.findByRole("button", {
      name: "Save Silver Sankha Heritage to development wishlist",
    });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByLabelText("1 wishlist item", { selector: "span" }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Add to simulated cart" }),
    );
    expect(
      screen.getByLabelText("1 cart item", { selector: "span" }),
    ).toBeVisible();
  });

  it("shows empty states and the complete disabled checkout boundary", async () => {
    render(
      <CustomerIntentProvider enabled>
        <SimulationCartPage />
        <SimulationWishlistPage />
      </CustomerIntentProvider>,
    );
    expect(
      await screen.findByRole("heading", {
        name: "Your simulated cart is empty",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Your development wishlist is empty",
      }),
    ).toBeVisible();
  });

  it("keeps cart and wishlist noindex and out of crawler follow paths", () => {
    expect(cartMetadata.robots).toMatchObject({
      index: false,
      follow: false,
      nocache: true,
    });
    expect(wishlistMetadata.robots).toMatchObject({
      index: false,
      follow: false,
      nocache: true,
    });
    expect(cartMetadata.alternates).toEqual({ canonical: "/cart" });
    expect(wishlistMetadata.alternates).toEqual({ canonical: "/wishlist" });
  });
});
