import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout from "@/app/layout";
import HomePage from "@/app/page";
import Loading from "@/app/loading";
import NotFound from "@/app/not-found";

describe("storefront root foundation", () => {
  it("renders the approved static homepage without commerce actions", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain("Ceremonial silver, shaped with modern discipline.");
    expect(html).toContain("Synthetic homepage product shells");
    expect(html).toContain("Add to cart");
    expect(html).not.toContain("Place order");
  });

  it("renders semantic root layout with skip link and landmarks", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>Test content</p>
      </RootLayout>,
    );
    expect(html).toContain('lang="en"');
    expect(html).toContain('href="#main-content"');
    expect(html).toContain("<header");
    expect(html).toContain("<main");
    expect(html).toContain("<footer");
  });

  it("renders accessible loading and not-found states", () => {
    const loading = renderToStaticMarkup(<Loading />);
    const notFound = renderToStaticMarkup(<NotFound />);
    expect(loading).toContain('aria-live="polite"');
    expect(loading).toContain('aria-busy="true"');
    expect(notFound).toContain("Page not found");
    expect(notFound).toContain('href="/"');
  });
});
