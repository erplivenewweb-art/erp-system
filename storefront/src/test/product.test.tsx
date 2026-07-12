// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ProductPage from "@/app/product/[slug]/page";
import { ProductGallery } from "@/features/product";
import { products } from "@/features/catalog";

describe("Phase 3E product experience", () => {
  it("renders one H1, breadcrumb, specifications and support sections", async () => {
    const view = await ProductPage({ params: Promise.resolve({ slug: products[0].slug }) });
    const { container } = render(view);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
    expect(screen.getByRole("table", { name: "Product specifications" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Related pieces" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Recently viewed" })).toBeVisible();
  });

  it("changes gallery media with accessible thumbnail controls", async () => {
    const user = userEvent.setup();
    render(<ProductGallery product={products[0]} />);
    const detail = screen.getByRole("tab", { name: "Show Detail view" });
    expect(detail).toHaveAttribute("aria-selected", "false");
    await user.click(detail);
    expect(detail).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("img", { name: `Reserved detail media for ${products[0].name}` })).toBeVisible();
  });

  it("provides named custom-order and wholesale calls to action", async () => {
    const view = await ProductPage({ params: Promise.resolve({ slug: products[0].slug }) });
    render(view);
    expect(screen.getByRole("link", { name: "Enquire about a custom order" })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: "Request a dealer quotation" })).toHaveAttribute("href", "/wholesale");
  });

  it("uses native accessible disclosures for care, shipping and return placeholders", async () => {
    const view = await ProductPage({ params: Promise.resolve({ slug: products[0].slug }) });
    render(view);
    expect(screen.getByText("Jewellery care guide").closest("summary")).toBeInTheDocument();
    expect(screen.getByText("Shipping information").closest("summary")).toBeInTheDocument();
    expect(screen.getByText("Return information").closest("summary")).toBeInTheDocument();
  });
});
