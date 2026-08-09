// @vitest-environment jsdom

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ComparePage from "@/app/compare/page";
import ProductsPage from "@/app/products/page";
import ProductPage from "@/app/products/[slug]/page";
import {
  developmentCategories,
  developmentProducts,
} from "@/features/catalogue-simulation";
import {
  DISCOVERY_SCHEMA_VERSION,
  DISCOVERY_STORAGE_KEY,
  DiscoveryProvider,
  DiscoveryListing,
  ProductDiscoveryBoundary,
  defaultDiscoveryState,
  filterAndSortDiscoveryProducts,
  fixtureDiscoveryProducts,
  parseDiscoveryState,
  restoreDiscoveryState,
} from "@/features/discovery-simulation";
import { ProductCMSProvider } from "@/features/product-cms-simulation";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: routerPush }),
}));

afterEach(() => {
  localStorage.clear();
  routerPush.mockReset();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const listing = () =>
  render(
    <DiscoveryListing
      categories={developmentCategories}
      enabled
      products={developmentProducts}
      query={{ limit: 24 }}
    />,
  );

describe("Phase 6K discovery domain", () => {
  it("combines filters and all deterministic sort modes", () => {
    const items = fixtureDiscoveryProducts(developmentProducts);
    const filtered = filterAndSortDiscoveryProducts(items, {
      ...defaultDiscoveryState.filters,
      category: "sankha",
      featured: true,
      wholesale: true,
      minPrice: 4000,
      maxPrice: 5000,
      sort: "PRICE_ASC",
    });
    expect(filtered.map((item) => item.product.slug)).toEqual([
      "silver-sankha-heritage",
    ]);
    expect(
      filterAndSortDiscoveryProducts(items, {
        ...defaultDiscoveryState.filters,
        sort: "PRICE_DESC",
      })[0].product.price.amount,
    ).toBe(8900);
    expect(
      filterAndSortDiscoveryProducts(items, {
        ...defaultDiscoveryState.filters,
        sort: "NAME_ASC",
      })[0].product.title,
    ).toBe("Ceremonial Sankha Pola Pair");
  });

  it("allowlists persistence and recovers malformed or unsupported data", () => {
    const parsed = parseDiscoveryState({
      ...defaultDiscoveryState,
      comparison: developmentProducts.map((item) => item.id),
      recentlyViewed: [
        ...developmentProducts.map((item) => item.id),
        ...developmentProducts.map((item) => item.id),
        ...developmentProducts.map((item) => `${item.id}-copy`),
        ...developmentProducts.map((item) => `${item.id}-more`),
      ],
      ignored: "not persisted",
    });
    expect(parsed?.comparison).toHaveLength(4);
    expect(
      parseDiscoveryState({
        ...defaultDiscoveryState,
        version: DISCOVERY_SCHEMA_VERSION + 1,
      }),
    ).toBeNull();
    localStorage.setItem(DISCOVERY_STORAGE_KEY, "{bad");
    expect(restoreDiscoveryState(localStorage).status).toBe("invalid");
    expect(localStorage.getItem(DISCOVERY_STORAGE_KEY)).toBeNull();
  });
});

describe("Phase 6K discovery UI", () => {
  it("performs instant search, highlighting, keyboard selection and history clearing", async () => {
    const user = userEvent.setup();
    vi.stubEnv("NODE_ENV", "development");
    render(await ProductsPage({ searchParams: Promise.resolve({}) }));
    const search = await screen.findByRole("combobox", {
      name: "Search products",
    });
    await user.type(search, "sankha");
    expect(screen.getByText("3 simulated products")).toBeVisible();
    expect(document.querySelector("mark")).toHaveTextContent(/sankha/i);
    const suggestionList = screen.getByRole("listbox");
    expect(suggestionList).toBeVisible();
    const options = within(suggestionList).getAllByRole("option");
    expect(options).toHaveLength(3);
    options.forEach((option) => expect(option).toBeVisible());
    expect(options[0]).toHaveTextContent("Silver Sankha Heritage");
    expect(options[0]).toHaveTextContent("Silver Sankha");
    expect(options[0]).toHaveTextContent("Traditional");
    expect(options[0].querySelector("[data-suggestion-thumbnail]")).toBeVisible();
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(search).toHaveAttribute("aria-activedescendant", options[0].id);
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(search).toHaveAttribute("aria-activedescendant", options[1].id);
    expect(fireEvent.keyDown(search, { key: "Enter" })).toBe(false);
    expect(routerPush).toHaveBeenCalledWith(
      "/products/silver-sankha-moonline",
    );
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByText("Recent searches")).toBeVisible();
    expect(
      JSON.parse(localStorage.getItem(DISCOVERY_STORAGE_KEY) ?? "{}")
        .recentSearches,
    ).toContain("Silver Sankha Moonline");
    await user.click(screen.getByRole("button", { name: "Clear history" }));
    expect(screen.queryByText("Recent searches")).not.toBeInTheDocument();
    search.blur();
    await user.click(search);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(search).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    await user.type(search, "pola");
    const mouseOption = within(screen.getByRole("listbox")).getAllByRole(
      "option",
    )[0];
    expect(mouseOption).toHaveAttribute(
      "href",
      "/products/silver-pola-classic",
    );
    await user.click(mouseOption);
    expect(routerPush).toHaveBeenLastCalledWith(
      "/products/silver-pola-classic",
    );
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    search.blur();
    await user.click(search);
    expect(screen.getByRole("listbox")).toBeVisible();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("applies category, collection, price and merchandising filters and resets", async () => {
    const user = userEvent.setup();
    listing();
    await screen.findByRole("combobox", { name: "Search products" });
    await user.selectOptions(screen.getByLabelText("Category"), "sankha");
    expect(screen.getByText("2 simulated products")).toBeVisible();
    await user.click(screen.getByLabelText("Featured"));
    expect(screen.getByText("1 simulated product")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Minimum simulated price"), {
      target: { value: "5000" },
    });
    expect(
      screen.getByRole("heading", { name: "No simulated products match" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByText("6 simulated products")).toBeVisible();
    await user.selectOptions(
      screen.getByLabelText("Collection"),
      screen.getAllByLabelText("Collection")[0].querySelectorAll("option")[1]
        .value,
    );
    expect(screen.getByLabelText("Active filters")).toHaveTextContent(
      "Collection selected",
    );
  });

  it("sorts results and persists comparison across remount", async () => {
    const user = userEvent.setup();
    vi.stubEnv("NODE_ENV", "development");
    const view = render(
      await ProductsPage({ searchParams: Promise.resolve({}) }),
    );
    await screen.findByRole("combobox", { name: "Search products" });
    await user.selectOptions(
      screen.getByLabelText("Sort products"),
      "PRICE_DESC",
    );
    const grid = screen.getByLabelText("Simulated product catalogue");
    expect(within(grid).getAllByRole("article")[0]).toHaveTextContent(
      "Ceremonial Sankha Pola Pair",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Add Ceremonial Sankha Pola Pair to comparison",
      }),
    );
    expect(screen.getByRole("link", { name: "Open comparison" })).toBeVisible();
    view.unmount();
    render(<ComparePage />);
    expect(
      await screen.findByRole("table", {
        name: "Browser-local simulated product comparison",
      }),
    ).toHaveTextContent("Ceremonial Sankha Pola Pair");
  });

  it("carries CMS product IDs into comparison immediately and after refresh", async () => {
    const user = userEvent.setup();
    vi.stubEnv("NODE_ENV", "development");
    const productsPage = await ProductsPage({ searchParams: Promise.resolve({}) });
    const wrapped = (children: ReactNode) => (
      <ProductCMSProvider enabled>
        <DiscoveryProvider enabled>{children}</DiscoveryProvider>
      </ProductCMSProvider>
    );
    const view = render(wrapped(productsPage));
    const compareButton = await screen.findByRole("button", {
      name: "Add Silver Sankha Heritage to comparison",
    });
    await user.click(compareButton);
    const persisted = JSON.parse(
      localStorage.getItem(DISCOVERY_STORAGE_KEY) ?? "{}",
    );
    expect(persisted.comparison).toEqual([
      "cms-dev-product-sankha-heritage",
    ]);

    view.rerender(wrapped(<ComparePage />));
    const comparisonTable = await screen.findByRole("table", {
      name: "Browser-local simulated product comparison",
    });
    const summaryCard = screen.getByRole("article");
    expect(comparisonTable).toHaveTextContent("Silver Sankha Heritage");
    expect(comparisonTable).not.toContainElement(summaryCard);
    expect(
      summaryCard.compareDocumentPosition(comparisonTable) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", {
        name: "Remove Silver Sankha Heritage from comparison",
      }),
    );
    expect(
      screen.getByRole("heading", { name: "No products selected" }),
    ).toBeVisible();

    persisted.comparison = ["cms-dev-product-sankha-heritage"];
    localStorage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(persisted));
    view.unmount();
    render(wrapped(<ComparePage />));
    expect(
      await screen.findByRole("table", {
        name: "Browser-local simulated product comparison",
      }),
    ).toHaveTextContent("Silver Sankha Heritage");
  });

  it("keeps the four-product comparison limit for CMS projections", async () => {
    const user = userEvent.setup();
    vi.stubEnv("NODE_ENV", "development");
    render(
      <ProductCMSProvider enabled>
        <DiscoveryProvider enabled>
          {await ProductsPage({ searchParams: Promise.resolve({}) })}
        </DiscoveryProvider>
      </ProductCMSProvider>,
    );
    const compareButtons = await screen.findAllByRole("button", {
      name: /Add .* to comparison/,
    });
    for (const button of compareButtons.slice(0, 5)) await user.click(button);
    const persisted = JSON.parse(
      localStorage.getItem(DISCOVERY_STORAGE_KEY) ?? "{}",
    );
    expect(persisted.comparison).toHaveLength(4);
    expect(compareButtons[4]).toHaveAttribute("aria-pressed", "false");
  });

  it("records recent views, provides deterministic recommendations and clears history", async () => {
    const user = userEvent.setup();
    vi.stubEnv("NODE_ENV", "development");
    const first = render(
      await ProductPage({
        params: Promise.resolve({ slug: "silver-sankha-heritage" }),
      }),
    );
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem(DISCOVERY_STORAGE_KEY) ?? "{}")
          .recentlyViewed,
      ).toContain(developmentProducts[0].id),
    );
    expect(
      screen.getByRole("heading", { name: "Customers also viewed" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Recommended for you" }),
    ).toBeVisible();
    first.unmount();
    render(
      await ProductPage({
        params: Promise.resolve({ slug: "silver-sankha-moonline" }),
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Recently viewed" }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Clear recently viewed" }),
    );
    expect(
      screen.queryByRole("heading", { name: "Recently viewed" }),
    ).not.toBeInTheDocument();
  });

  it("uses browser-only sharing and fails closed when discovery is disabled", async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    const view = render(
      <ProductDiscoveryBoundary
        enabled
        product={developmentProducts[0]}
        products={developmentProducts}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("/products/silver-sankha-heritage"),
    );
    expect(screen.getByText("Product link copied.")).toBeVisible();
    view.unmount();
    localStorage.clear();
    render(
      <DiscoveryListing
        categories={developmentCategories}
        enabled={false}
        products={developmentProducts}
        query={{ limit: 24 }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /comparison/i }),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem(DISCOVERY_STORAGE_KEY)).toBeNull();
  });

  it("synchronizes allowlisted state across tabs", async () => {
    listing();
    await screen.findByRole("combobox", { name: "Search products" });
    const next = {
      ...defaultDiscoveryState,
      recentSearches: ["Cross-tab Pola"],
    };
    localStorage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: DISCOVERY_STORAGE_KEY,
        newValue: JSON.stringify(next),
      }),
    );
    expect(await screen.findByText("Cross-tab Pola")).toBeVisible();
  });

  it("has no automatic accessibility violations in the discovery controls", async () => {
    const { container } = listing();
    await screen.findByRole("combobox", { name: "Search products" });
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
