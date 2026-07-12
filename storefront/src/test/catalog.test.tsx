// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ShopPage, { metadata as shopMetadata } from "@/app/shop/page";
import CollectionsPage from "@/app/collections/page";
import SearchPage from "@/app/search/page";
import ComparePage from "@/app/compare/page";
import CollectionPage from "@/app/collections/[slug]/page";
import CategoryPage from "@/app/category/[slug]/page";
import { collections, products } from "@/features/catalog";

describe("Phase 3E catalogue screens", () => {
  it("renders the shop landing with one H1, collections, filters and products", () => {
    const { container } = render(<ShopPage />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Silver forms, presented with clarity" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "Catalogue filters" })).toBeVisible();
    expect(screen.getByLabelText("Sort by")).toHaveTextContent("Featured");
    expect(screen.getByRole("link", { name: "Dealer introduction" })).toHaveAttribute("href", "/wholesale");
  });

  it("renders every required collection card", () => {
    render(<CollectionsPage />);
    for (const collection of collections) expect(screen.getByRole("link", { name: collection.name })).toBeVisible();
  });

  it("renders reusable collection and category listing routes", async () => {
    const collectionView = await CollectionPage({ params: Promise.resolve({ slug: "silver-sankha" }) });
    const { unmount } = render(collectionView);
    expect(screen.getByRole("heading", { level: 1, name: "Silver Sankha" })).toBeVisible();
    unmount();
    const categoryView = await CategoryPage({ params: Promise.resolve({ slug: "pola" }) });
    render(categoryView);
    expect(screen.getByRole("heading", { level: 1, name: "Pola Forms" })).toBeVisible();
  });

  it("includes honest availability, facts, favorites and quick-view shells", () => {
    render(<ShopPage />);
    const featured = products.filter((product) => product.featured);
    expect(screen.getAllByText("Availability not connected")).toHaveLength(featured.length);
    expect(screen.getAllByRole("button", { name: /Save .* for later/ })).toHaveLength(featured.length);
    expect(screen.getAllByRole("link", { name: "Quick view" })).toHaveLength(featured.length);
  });

  it("exposes no numeric retail or wholesale price", () => {
    const html = renderToStaticMarkup(<ShopPage />);
    expect(html).not.toMatch(/₹\s*\d|INR\s*\d|wholesale price\s*[:₹]\s*\d/i);
    expect(html).toContain("Retail price pending publication");
  });

  it("renders search empty/result and comparison shells", () => {
    const { unmount } = render(<SearchPage />);
    expect(screen.getByRole("status")).toHaveTextContent("No search submitted");
    unmount();
    render(<ComparePage />);
    expect(screen.getByRole("region", { name: "Product comparison" })).toBeVisible();
  });

  it("publishes canonical OpenGraph-ready shop metadata without a domain", () => {
    expect(shopMetadata.alternates).toEqual({ canonical: "/shop" });
    expect(shopMetadata.openGraph).toMatchObject({ type: "website" });
    expect(JSON.stringify(shopMetadata)).not.toMatch(/https?:\/\//);
  });
});
