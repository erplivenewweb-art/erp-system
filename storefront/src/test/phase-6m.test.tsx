// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import ComparePage from "@/app/compare/page";
import {
  DISCOVERY_STORAGE_KEY,
  DiscoveryProvider,
  defaultDiscoveryState,
} from "@/features/discovery-simulation";
import { ProductCMSProvider } from "@/features/product-cms-simulation";

afterEach(() => localStorage.clear());

describe("Phase 6M presentation regression", () => {
  it("keeps the public homepage accessible after the visual polish", async () => {
    const { container } = render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
    expect(results.violations).toEqual([]);
  });

  it("keeps comparison summaries outside the attribute table", async () => {
    localStorage.setItem(
      DISCOVERY_STORAGE_KEY,
      JSON.stringify({
        ...defaultDiscoveryState,
        comparison: [
          "cms-dev-product-sankha-heritage",
          "cms-dev-product-sankha-moonline",
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
    const summaries = screen.getByRole("region", {
      name: "Compared product summaries",
    });
    expect(summaries).not.toContainElement(table);
    expect(summaries.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
  });

  it("uses token-based sizing for cards, controls and the comparison matrix", () => {
    const catalogue = readFileSync(
      join(process.cwd(), "src/features/catalogue-simulation/Catalogue.module.css"),
      "utf8",
    );
    const comparison = readFileSync(
      join(process.cwd(), "src/features/discovery-simulation/Discovery.module.css"),
      "utf8",
    );
    const cms = readFileSync(
      join(process.cwd(), "src/features/product-cms-simulation/ProductCMS.module.css"),
      "utf8",
    );

    expect(catalogue).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(catalogue).toContain("-webkit-line-clamp: 2");
    expect(comparison).toContain('.comparisonMatrix[data-columns="4"]');
    expect(comparison).toContain("width: 10rem");
    expect(cms).toContain("min-height: var(--sf-layout-touch-min)");
  });
});
