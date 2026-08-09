// @vitest-environment jsdom

import { JSDOM } from "jsdom";
import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProductsPage, {
  developmentSimulationMode,
  metadata,
} from "@/app/products/page";
import ProductsLoading from "@/app/products/loading";
import ProductsError from "@/app/products/error";
import ProductPage, {
  generateMetadata,
  generateStaticParams,
} from "@/app/products/[slug]/page";
import ProductNotFound from "@/app/products/[slug]/not-found";
import {
  CatalogueProductMedia,
  CatalogueValidationError,
  DevelopmentCatalogueIndicator,
  catalogueQuery,
  createCatalogueService,
  createDevelopmentCatalogueProvider,
  developmentCategories,
  developmentProducts,
  normalizeKeyword,
} from "@/features/catalogue-simulation";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Phase 6C development catalogue contract", () => {
  it("validates all deterministic fictional fixtures", async () => {
    const service = createCatalogueService(
      createDevelopmentCatalogueProvider(),
    );
    const first = await service.listProducts({ limit: 24 });
    const second = await service.listProducts({ limit: 24 });

    expect(first).toEqual(second);
    expect(first.items).toHaveLength(6);
    expect(developmentCategories).toHaveLength(4);
    expect(new Set(first.items.map(({ id }) => id)).size).toBe(
      first.items.length,
    );
    expect(new Set(first.items.map(({ slug }) => slug)).size).toBe(
      first.items.length,
    );
    expect(JSON.stringify(first)).not.toMatch(
      /erpId|barcode|supplier|karigar|internalCost|exactStock/i,
    );
  });

  it("implements listing, lookup, categories and search provider methods", async () => {
    const service = createCatalogueService(
      createDevelopmentCatalogueProvider(),
    );

    expect((await service.listCategories()).map(({ slug }) => slug)).toEqual(
      developmentCategories.map(({ slug }) => slug),
    );
    expect(
      (await service.getProductBySlug("silver-sankha-heritage"))?.title,
    ).toBe("Silver Sankha Heritage");
    expect(await service.getProductBySlug("missing-product")).toBeUndefined();
    expect((await service.searchProducts("sAnKhA", 24)).page.total).toBe(3);
  });

  it("fails closed when a provider returns an invalid response", async () => {
    const service = createCatalogueService(
      createDevelopmentCatalogueProvider("invalid"),
    );

    await expect(service.listProducts({ limit: 24 })).rejects.toBeInstanceOf(
      CatalogueValidationError,
    );
  });
});

describe("Phase 6C search and filtering", () => {
  it("normalizes whitespace, case and long queries safely", async () => {
    expect(normalizeKeyword("   Silver    SANKHA   ")).toBe("Silver SANKHA");
    expect(normalizeKeyword("x".repeat(120))).toHaveLength(80);
    expect(normalizeKeyword("   ")).toBeUndefined();

    const service = createCatalogueService(
      createDevelopmentCatalogueProvider(),
    );
    expect(
      (await service.searchProducts("  silver   sankha  ", 24)).page.total,
    ).toBe(2);
    expect((await service.searchProducts("[]{}!@#", 24)).items).toEqual([]);
  });

  it("filters by category, purity, availability and audience", async () => {
    const service = createCatalogueService(
      createDevelopmentCatalogueProvider(),
    );

    expect(
      (await service.listProducts({ category: "pola", limit: 24 })).page.total,
    ).toBe(2);
    expect(
      (await service.listProducts({ purity: "999_SILVER", limit: 24 })).page
        .total,
    ).toBe(1);
    expect(
      (await service.listProducts({ availability: "MADE_TO_ORDER", limit: 24 }))
        .page.total,
    ).toBe(1);
    expect(
      (await service.listProducts({ audience: "B2B", limit: 24 })).items.every(
        ({ b2bVisible }) => b2bVisible,
      ),
    ).toBe(true);
  });

  it("ignores unsupported enums and duplicate query values", () => {
    expect(
      catalogueQuery({
        purity: "NOT_REAL",
        availability: "UNKNOWN",
        q: ["one", "two"],
      }),
    ).toEqual({ limit: 24 });
  });
});

describe("Phase 6C catalogue routes and states", () => {
  it("renders the listing, filters, result count and accessible product links", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const view = await ProductsPage({ searchParams: Promise.resolve({}) });
    const { container } = render(view);

    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByLabelText("Search products")).toBeVisible();
    expect(screen.getByLabelText("Category")).toBeVisible();
    expect(screen.getByText("6 simulated products")).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: "View product details" }),
    ).toHaveLength(6);
    expect(
      screen.getByText("Development catalogue — simulated data"),
    ).toBeVisible();
  });

  it("renders empty, provider-unavailable and invalid-response states", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const empty = await ProductsPage({
      searchParams: Promise.resolve({ simulate: "empty" }),
    });
    const { unmount } = render(empty);
    expect(
      screen.getByRole("heading", { name: "No simulated products match" }),
    ).toBeVisible();
    unmount();

    const unavailable = await ProductsPage({
      searchParams: Promise.resolve({ simulate: "unavailable" }),
    });
    render(unavailable);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "CATALOGUE_PROVIDER_UNAVAILABLE",
    );
    cleanup();

    const invalid = await ProductsPage({
      searchParams: Promise.resolve({ simulate: "invalid" }),
    });
    render(invalid);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "CATALOGUE_RESPONSE_INVALID",
    );
  });

  it("keeps development simulation controls and indicator disabled in production", () => {
    expect(developmentSimulationMode("empty", "production")).toBe("success");
    expect(developmentSimulationMode("empty", "development")).toBe("empty");
    const { container } = render(
      <DevelopmentCatalogueIndicator visible={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders loading, route error and not-found states", () => {
    const { unmount } = render(<ProductsLoading />);
    expect(screen.getAllByRole("status")).toHaveLength(6);
    unmount();
    render(<ProductsError />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Development catalogue unavailable",
    );
    unmount();
    render(<ProductNotFound />);
    expect(
      screen.getByRole("heading", { name: "Development product not found" }),
    ).toBeVisible();
  });

  it("renders product detail, presentation choices, care and related products", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const view = await ProductPage({
      params: Promise.resolve({ slug: "silver-sankha-heritage" }),
    });
    render(view);

    expect(
      screen.getByRole("heading", { level: 1, name: "Silver Sankha Heritage" }),
    ).toBeVisible();
    expect(
      screen.getByLabelText("Silver Sankha Heritage gallery"),
    ).toBeVisible();
    expect(screen.getByLabelText("Select size for presentation")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Product highlights" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Care information" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Enquire for wholesale" }),
    ).toHaveAttribute("href", "/wholesale");
    expect(
      screen.getByText(/No order, reservation or payment action/),
    ).toBeVisible();
  });

  it("publishes stable route and SEO metadata without external URLs", async () => {
    expect(generateStaticParams()).toHaveLength(developmentProducts.length);
    expect(metadata.alternates).toEqual({ canonical: "/products" });
    const detailMetadata = await generateMetadata({
      params: Promise.resolve({ slug: "silver-pola-classic" }),
    });
    expect(detailMetadata.alternates).toEqual({
      canonical: "/products/silver-pola-classic",
    });
    expect(JSON.stringify(detailMetadata)).not.toMatch(/https?:\/\//);
  });

  it("renders a graceful missing-media placeholder with descriptive text", () => {
    render(<CatalogueProductMedia media={developmentProducts[0].media[0]} />);
    const image = screen.getByRole("img", {
      name: developmentProducts[0].media[0].alt,
    });
    expect(image).toHaveAttribute("data-missing-image", "true");
    expect(image).toHaveTextContent("development placeholder");
  });

  it("has no automatic axe violations in list and detail content", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const list = await ProductsPage({ searchParams: Promise.resolve({}) });
    const detail = await ProductPage({
      params: Promise.resolve({ slug: "silver-pola-classic" }),
    });
    for (const content of [list, detail]) {
      const markup = renderToStaticMarkup(
        <main id="main-content">{content}</main>,
      );
      const dom = new JSDOM(
        `<!doctype html><html lang="en"><head><title>Development catalogue</title></head><body>${markup}</body></html>`,
        { runScripts: "outside-only" },
      );
      dom.window.eval(axe.source);
      const results = await dom.window.axe.run(dom.window.document, {
        rules: { "color-contrast": { enabled: false } },
      });
      expect(results.violations).toEqual([]);
    }
  });
});
