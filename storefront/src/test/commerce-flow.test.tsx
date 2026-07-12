// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import CartRoute, { metadata as cartMetadata } from "@/app/cart/page";
import WishlistRoute from "@/app/wishlist/page";
import CheckoutRoute, { metadata as checkoutMetadata } from "@/app/checkout/page";
import SuccessRoute from "@/app/order-success/page";
import OrdersRoute from "@/app/orders/page";
import { EmptyCart, MiniCart, OrderSummary, commerceItems } from "@/features/cart";
import { CheckoutStepper } from "@/features/checkout";
import { EmptyWishlist } from "@/features/wishlist";

describe("Phase 3F static commerce experience", () => {
  it("renders cart items, quantity controls, actions and summary without calculations", () => { const { container } = render(<CartRoute />); expect(container.querySelectorAll("h1")).toHaveLength(1); expect(screen.getAllByRole("button", { name: /Increase .* quantity/ })).toHaveLength(commerceItems.length); expect(screen.getAllByRole("button", { name: "Save for later" })).toHaveLength(commerceItems.length); expect(screen.getByRole("complementary", { name: "Order summary" })).toHaveTextContent("Pending cart calculation"); });
  it("opens and closes the accessible mini-cart drawer", async () => { const user = userEvent.setup(); render(<MiniCart />); const trigger = screen.getByRole("button", { name: "Preview mini cart" }); await user.click(trigger); const dialog = screen.getByRole("dialog", { name: "Your bag" }); expect(dialog).toHaveAttribute("open"); await user.click(screen.getByRole("button", { name: "Close Your bag" })); expect(dialog).not.toHaveAttribute("open"); expect(trigger).toHaveFocus(); });
  it("renders wishlist cards and an honest empty state", () => { render(<WishlistRoute />); expect(screen.getAllByRole("button", { name: "Move to cart" })).toHaveLength(commerceItems.length); expect(screen.getByText("Your wishlist is empty")).toBeVisible(); });
  it("renders labelled checkout fields, methods, consent and order review", () => { const { container } = render(<CheckoutRoute />); expect(container.querySelectorAll("h1")).toHaveLength(1); expect(screen.getByLabelText("Full name")).toBeVisible(); expect(screen.getByLabelText("Billing address is the same as shipping")).toBeVisible(); expect(screen.getByRole("button", { name: "Place order preview" })).toHaveAttribute("type", "button"); expect(screen.getByText("No card, bank or payment credentials are collected.")).toBeVisible(); });
  it("marks the current step accessibly", () => { render(<CheckoutStepper current="Review" />); expect(screen.getByText("Review")).toHaveAttribute("aria-current", "step"); expect(screen.getByRole("navigation", { name: "Checkout progress" })).toBeVisible(); });
  it("renders order confirmation with no fabricated identifiers", () => { render(<SuccessRoute />); expect(screen.getByRole("heading", { level: 1, name: "Thank you for reviewing the journey" })).toBeVisible(); expect(screen.getByText("Not generated")).toBeVisible(); expect(screen.getByText("No shipment exists")).toBeVisible(); });
  it("renders all reusable empty states", () => { const { unmount } = render(<EmptyCart />); expect(screen.getByRole("status")).toHaveTextContent("Your cart is empty"); unmount(); const second = render(<EmptyWishlist />); expect(screen.getByRole("status")).toHaveTextContent("Your wishlist is empty"); second.unmount(); render(<OrdersRoute />); expect(screen.getByRole("heading", { level: 1, name: "No orders yet" })).toBeVisible(); });
  it("keeps protected pages noindex and canonical paths relative", () => { expect(cartMetadata.robots).toMatchObject({ index: false }); expect(cartMetadata.alternates).toEqual({ canonical: "/cart" }); expect(checkoutMetadata.robots).toEqual({ index: false, follow: false }); expect(JSON.stringify([cartMetadata, checkoutMetadata])).not.toContain("https://"); });
  it("provides standalone order summary semantics", () => { render(<OrderSummary />); expect(screen.getByRole("complementary", { name: "Order summary" })).toBeVisible(); expect(screen.getByRole("link", { name: "Continue to checkout" })).toHaveAttribute("href", "/checkout"); });
});
