// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import CartRoute, { metadata as cartMetadata } from "@/app/cart/page";
import WishlistRoute from "@/app/wishlist/page";
import { metadata as checkoutMetadata } from "@/app/checkout/page";
import SuccessRoute from "@/app/order-success/page";
import OrdersRoute from "@/app/orders/page";
import { EmptyCart, MiniCart, OrderSummary } from "@/features/cart";
import {
  CheckoutPage as CheckoutRoute,
  CheckoutStepper,
} from "@/features/checkout";
import { EmptyWishlist } from "@/features/wishlist";
import {
  CustomerIntentProvider,
  ProductIntentActions,
} from "@/features/customer-intent";
import { developmentProducts } from "@/features/catalogue-simulation";

describe("Phase 3F static commerce experience", () => {
  it("renders the hydration-safe simulated cart route and honest empty state", async () => {
    render(
      <CustomerIntentProvider enabled>
        <CartRoute />
      </CustomerIntentProvider>,
    );
    expect(
      await screen.findByRole("heading", {
        name: "Your simulated cart is empty",
      }),
    ).toBeVisible();
    expect(screen.getByText(/No personal data/)).toBeVisible();
  });
  it("opens and closes the accessible mini-cart drawer", async () => {
    const user = userEvent.setup();
    render(<MiniCart />);
    const trigger = screen.getByRole("button", { name: "Preview mini cart" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Your bag" });
    expect(dialog).toHaveAttribute("open");
    await user.click(screen.getByRole("button", { name: "Close Your bag" }));
    expect(dialog).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });
  it("renders wishlist intent and an honest empty state", async () => {
    const user = userEvent.setup();
    render(
      <CustomerIntentProvider enabled>
        <ProductIntentActions product={developmentProducts[0]} />
        <WishlistRoute />
      </CustomerIntentProvider>,
    );
    expect(
      await screen.findByRole("heading", {
        name: "Your development wishlist is empty",
      }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", {
        name: "Save Silver Sankha Heritage to development wishlist",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Add to simulated cart" }),
    ).toBeVisible();
  });
  it("renders labelled checkout fields, methods, consent and order review", () => {
    const { container } = render(<CheckoutRoute />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByLabelText("Full name")).toBeVisible();
    expect(
      screen.getByLabelText("Billing address is the same as shipping"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Place order preview" }),
    ).toHaveAttribute("type", "button");
    expect(
      screen.getByText("No card, bank or payment credentials are collected."),
    ).toBeVisible();
  });
  it("marks the current step accessibly", () => {
    render(<CheckoutStepper current="Review" />);
    expect(screen.getByText("Review")).toHaveAttribute("aria-current", "step");
    expect(
      screen.getByRole("navigation", { name: "Checkout progress" }),
    ).toBeVisible();
  });
  it("renders order confirmation with no fabricated identifiers", () => {
    render(<SuccessRoute />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Thank you for reviewing the journey",
      }),
    ).toBeVisible();
    expect(screen.getByText("Not generated")).toBeVisible();
    expect(screen.getByText("No shipment exists")).toBeVisible();
  });
  it("renders all reusable empty states", () => {
    const { unmount } = render(<EmptyCart />);
    expect(screen.getByRole("status")).toHaveTextContent("Your cart is empty");
    unmount();
    const second = render(<EmptyWishlist />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your wishlist is empty",
    );
    second.unmount();
    render(<OrdersRoute />);
    expect(
      screen.getByRole("heading", { level: 1, name: "No orders yet" }),
    ).toBeVisible();
  });
  it("keeps protected pages noindex and canonical paths relative", () => {
    expect(cartMetadata.robots).toMatchObject({ index: false });
    expect(cartMetadata.alternates).toEqual({ canonical: "/cart" });
    expect(checkoutMetadata.robots).toMatchObject({
      index: false,
      follow: false,
      nocache: true,
    });
    expect(JSON.stringify([cartMetadata, checkoutMetadata])).not.toContain(
      "https://",
    );
  });
  it("provides standalone order summary semantics", () => {
    render(<OrderSummary />);
    expect(
      screen.getByRole("complementary", { name: "Order summary" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Continue to checkout" }),
    ).toHaveAttribute("href", "/checkout");
  });
});
