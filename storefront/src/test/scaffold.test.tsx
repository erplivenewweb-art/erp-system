import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout from "@/app/layout";
import ScaffoldPage from "@/app/page";
import Loading from "@/app/loading";
import NotFound from "@/app/not-found";

describe("Phase 3A scaffold", () => {
  it("renders the root page identity and scope", () => {
    const html = renderToStaticMarkup(<ScaffoldPage />);
    expect(html).toContain("Isolated storefront scaffold");
    expect(html).toContain("Foundation only");
    expect(html).not.toContain("Add to cart");
  });

  it("renders semantic root layout with skip link and landmarks", () => {
    const html = renderToStaticMarkup(
      <RootLayout><p>Test content</p></RootLayout>,
    );
    expect(html).toContain('lang="en"');
    expect(html).toContain('href="#main-content"');
    expect(html).toContain("<header");
    expect(html).toContain('<main');
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

