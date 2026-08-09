// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ComparePage from "@/app/compare/page";
import ProductsPage from "@/app/products/page";
import {
  DISCOVERY_STORAGE_KEY,
  DiscoveryProvider,
  defaultDiscoveryState,
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
});

describe("Phase 6N visual-debt and performance regression", () => {
  it("renders the real autocomplete below its input row and preserves keyboard selection", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const user = userEvent.setup();
    render(await ProductsPage({ searchParams: Promise.resolve({}) }));
    const search = await screen.findByRole("combobox", {
      name: "Search products",
    });
    await user.type(search, "sankha");

    const listbox = screen.getByRole("listbox");
    const inputRow = search.parentElement;
    expect(inputRow).not.toBeNull();
    expect(
      inputRow!.compareDocumentPosition(listbox) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByLabelText("Simulated product catalogue")).not.toContainElement(
      listbox,
    );

    const options = within(listbox).getAllByRole("option");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(search, { key: "Enter" });
    expect(routerPush).toHaveBeenCalledWith("/products/silver-sankha-heritage");
  });

  it("keeps equal comparison columns and product summaries outside the table", async () => {
    localStorage.setItem(
      DISCOVERY_STORAGE_KEY,
      JSON.stringify({
        ...defaultDiscoveryState,
        comparison: [
          "cms-dev-product-sankha-heritage",
          "cms-dev-product-sankha-moonline",
          "cms-dev-product-pola-classic",
        ],
      }),
    );
    render(
      <ProductCMSProvider enabled>
        <DiscoveryProvider enabled>
          <ComparePage />
        </DiscoveryProvider>
      </ProductCMSProvider>,
    );

    const table = await screen.findByRole("table", {
      name: "Browser-local simulated product comparison",
    });
    const summary = screen.getByRole("region", {
      name: "Compared product summaries",
    });
    expect(within(summary).getAllByRole("article")).toHaveLength(3);
    expect(table.querySelectorAll("col")).toHaveLength(4);
    expect(table).not.toContainElement(within(summary).getAllByRole("article")[0]);
    within(table)
      .getAllByRole("row")
      .forEach((row) => expect(row.querySelectorAll("th, td")).toHaveLength(4));
  });

  it("retains explicit layout reservations and memoized discovery projections", () => {
    const discoverySource = readFileSync(
      join(process.cwd(), "src/features/discovery-simulation/DiscoveryExperience.tsx"),
      "utf8",
    );
    const catalogueStyles = readFileSync(
      join(process.cwd(), "src/features/catalogue-simulation/Catalogue.module.css"),
      "utf8",
    );
    const homeStyles = readFileSync(
      join(process.cwd(), "src/features/home/HomePage.module.css"),
      "utf8",
    );

    expect(discoverySource).toContain("const suggestions = useMemo");
    expect(discoverySource).toContain("const collectionOptions = useMemo");
    expect(catalogueStyles).toContain("contain-intrinsic-size: auto 38rem");
    expect(homeStyles).toContain("contain-intrinsic-size: auto 40rem");
  });
});
