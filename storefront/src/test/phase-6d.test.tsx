// @vitest-environment jsdom

import { JSDOM } from "jsdom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import HomePage, { metadata as homeMetadata } from "@/app/page";
import ProductPage, {
  generateMetadata as productMetadata,
} from "@/app/products/[slug]/page";
import ProductCategoryPage, {
  generateMetadata as categoryMetadata,
  generateStaticParams as categoryParams,
} from "@/app/products/category/[slug]/page";
import AboutPage from "@/app/about/page";
import ContactPage from "@/app/contact/page";
import { PublicHeader } from "@/components/public-shell";
import {
  CatalogueSearch,
  SimulationProductCard,
  SimulationProductGallery,
  developmentProducts,
} from "@/features/catalogue-simulation";

afterEach(() => {
  localStorage.clear();
});

describe("Phase 6D premium public shopping experience", () => {
  it("renders premium homepage merchandising and simulation-safe calls to action", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Ceremonial silver, shaped with modern discipline.",
      }),
    ).toBeVisible();
    expect(screen.getByText("Trending now")).toBeVisible();
    expect(screen.getByText("New arrivals")).toBeVisible();
    expect(screen.getByText("Best sellers")).toBeVisible();
    expect(
      screen.getAllByRole("link", {
        name: "Explore the complete simulated catalogue",
      }),
    ).toHaveLength(4);
    expect(screen.getAllByText(/Simulated retail ₹/).length).toBeGreaterThan(0);
  });

  it("provides the required desktop and responsive navigation destinations", () => {
    render(<PublicHeader />);
    const primary = screen.getByRole("navigation", { name: "Primary" });

    for (const label of [
      "Home",
      "Products",
      "Categories",
      "About",
      "Contact",
      "Wholesale",
    ]) {
      expect(primary).toHaveTextContent(label);
    }
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute(
      "href",
      "/products#catalogue-search",
    );
  });

  it("adds honest wishlist and Quick View placeholders to premium product cards", () => {
    render(<SimulationProductCard product={developmentProducts[0]} />);

    expect(
      screen.getByRole("button", {
        name: "Save Silver Sankha Heritage to development wishlist",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Quick view Silver Sankha Heritage",
      }),
    ).toBeDisabled();
    expect(screen.getByText("FEATURED")).toBeVisible();
    expect(screen.getByText("925 silver")).toBeVisible();
  });

  it("offers live highlighted suggestions, clearing and development recents", async () => {
    localStorage.setItem(
      "silver-sankha-development-recent-searches",
      JSON.stringify(["Pola"]),
    );
    const user = userEvent.setup();
    render(
      <CatalogueSearch products={developmentProducts} showDevelopmentRecents />,
    );

    expect(
      await screen.findByText("Recent development searches"),
    ).toBeVisible();
    const input = screen.getByRole("combobox", { name: "Search products" });
    await user.type(input, "sankha");
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    expect(document.querySelector("mark")).toHaveTextContent(/sankha/i);
    await user.click(
      screen.getByRole("button", { name: "Clear product search" }),
    );
    expect(input).toHaveValue("");
  });

  it("keeps recent-search UI unavailable outside development presentation", () => {
    localStorage.setItem(
      "silver-sankha-development-recent-searches",
      JSON.stringify(["Pola"]),
    );
    render(
      <CatalogueSearch
        products={developmentProducts}
        showDevelopmentRecents={false}
      />,
    );
    expect(
      screen.queryByText("Recent development searches"),
    ).not.toBeInTheDocument();
  });

  it("supports keyboard-operable gallery thumbnails and a zoom-ready boundary", async () => {
    const user = userEvent.setup();
    const product = developmentProducts[0];
    const { container } = render(
      <SimulationProductGallery
        media={product.media}
        productTitle={product.title}
      />,
    );

    expect(
      container.querySelector('[data-zoom-ready="true"]'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Zoom preview is unavailable in development",
      }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Show detail view" }));
    expect(
      screen.getAllByRole("img", { name: product.media[1].alt }),
    ).toHaveLength(2);
  });

  it("renders category banner, count, sort shell, filter path and products", async () => {
    const view = await ProductCategoryPage({
      params: Promise.resolve({ slug: "sankha" }),
    });
    render(view);

    expect(
      screen.getByRole("heading", { level: 1, name: "Silver Sankha" }),
    ).toBeVisible();
    expect(screen.getByText("2 fictional products")).toBeVisible();
    expect(screen.getByLabelText("Sort presentation")).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Open filter panel" }),
    ).toHaveAttribute("href", "/products?category=sankha");
  });

  it("publishes Open Graph, Twitter, Product and Breadcrumb metadata safely", async () => {
    expect(homeMetadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(categoryParams()).toHaveLength(4);
    expect(
      await categoryMetadata({
        params: Promise.resolve({ slug: "pola" }),
      }),
    ).toMatchObject({
      alternates: { canonical: "/products/category/pola" },
      twitter: { card: "summary_large_image" },
    });
    expect(
      await productMetadata({
        params: Promise.resolve({ slug: "silver-sankha-heritage" }),
      }),
    ).toMatchObject({ twitter: { card: "summary_large_image" } });

    const product = await ProductPage({
      params: Promise.resolve({ slug: "silver-sankha-heritage" }),
    });
    const markup = renderToStaticMarkup(product);
    expect(markup).toContain('"@type":"Product"');
    expect(markup).toContain('"@type":"BreadcrumbList"');
    expect(markup).not.toMatch(/erpId|barcode|exactStock|supplier/i);
  });

  it("keeps About and Contact navigation destinations valid", () => {
    const { unmount } = render(<AboutPage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
    unmount();
    render(<ContactPage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
  });

  it("has no automatic accessibility violations in category content", async () => {
    const category = await ProductCategoryPage({
      params: Promise.resolve({ slug: "pola" }),
    });
    const markup = renderToStaticMarkup(
      <main id="main-content">{category}</main>,
    );
    const dom = new JSDOM(
      `<!doctype html><html lang="en"><head><title>Silver Pola</title></head><body>${markup}</body></html>`,
      { runScripts: "outside-only" },
    );
    dom.window.eval(axe.source);
    const results = await dom.window.axe.run(dom.window.document, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
