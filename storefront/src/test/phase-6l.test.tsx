// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { developmentProducts } from "@/features/catalogue-simulation";
import {
  CART_STORAGE_KEY,
  CustomerIntentProvider,
  IntentNavigationActions,
  ProductDetailIntent,
  ProductIntentActions,
  SimulationWishlistPage,
  WISHLIST_STORAGE_KEY,
} from "@/features/customer-intent";

beforeEach(() => localStorage.clear());

describe("Phase 6L shopping experience", () => {
  it("adds the selected detail quantity and exposes a simulation-only buy-now route", async () => {
    const user = userEvent.setup();
    render(
      <CustomerIntentProvider enabled>
        <div
          onClickCapture={(event) => {
            if ((event.target as Element).closest('a[href="/checkout"]')) {
              event.preventDefault();
            }
          }}
        >
          <ProductDetailIntent product={developmentProducts[0]} />
          <IntentNavigationActions />
        </div>
      </CustomerIntentProvider>,
    );

    await user.selectOptions(
      await screen.findByLabelText("Quantity"),
      "3",
    );
    await user.click(
      screen.getByRole("button", {
        name: `Add ${developmentProducts[0].title} to simulated cart`,
      }),
    );

    expect(screen.getByLabelText("3 cart items")).toBeVisible();
    const buyNow = screen.getByRole("link", { name: "Buy now preview" });
    expect(buyNow).toHaveAttribute("href", "/checkout");
    await user.click(buyNow);
    expect(screen.getByLabelText("6 cart items")).toBeVisible();
    expect(
      screen.getByText("Opening simulation-only checkout preview."),
    ).toBeVisible();
  });

  it("adds a deterministic frequently-bought-together group atomically", async () => {
    const user = userEvent.setup();
    render(
      <CustomerIntentProvider enabled>
        <ProductDetailIntent product={developmentProducts[0]} />
        <IntentNavigationActions />
      </CustomerIntentProvider>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Add all to simulated cart",
      }),
    );
    expect(screen.getByLabelText("3 cart items")).toBeVisible();
    expect(screen.getByText(/3 pieces added to the simulated cart together/i)).toBeVisible();
  });

  it("moves a wished-for product into the cart and persists both states", async () => {
    const user = userEvent.setup();
    render(
      <CustomerIntentProvider enabled>
        <ProductIntentActions product={developmentProducts[0]} />
        <SimulationWishlistPage />
        <IntentNavigationActions />
      </CustomerIntentProvider>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: /Save Silver Sankha Heritage to development wishlist/,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Add to simulated cart" }),
    );

    expect(screen.getByLabelText("1 cart item")).toBeVisible();
    expect(screen.queryByLabelText("1 wishlist item")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem(CART_STORAGE_KEY)).toContain(
        developmentProducts[0].id,
      );
      expect(localStorage.getItem(WISHLIST_STORAGE_KEY)).not.toContain(
        developmentProducts[0].id,
      );
    });
  });

  it("renders route skeletons with accessible loading status", async () => {
    const CartLoading = (await import("@/app/cart/loading")).default;
    const WishlistLoading = (await import("@/app/wishlist/loading")).default;
    const { unmount } = render(<CartLoading />);
    expect(screen.getByRole("status", { name: "Loading simulated cart" })).toBeVisible();
    unmount();
    render(<WishlistLoading />);
    expect(
      screen.getByRole("status", { name: "Loading development wishlist" }),
    ).toBeVisible();
  });
});
