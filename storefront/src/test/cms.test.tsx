// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Dashboard, { metadata as cmsMetadata } from "@/app/cms/page";
import Homepage from "@/app/cms/homepage/page";
import Products from "@/app/cms/products/page";
import Collections from "@/app/cms/collections/page";
import Categories from "@/app/cms/categories/page";
import Banners from "@/app/cms/banners/page";
import Media from "@/app/cms/media/page";
import Blog from "@/app/cms/blog/page";
import SEO from "@/app/cms/seo/page";
import Theme from "@/app/cms/theme/page";
import Navigation from "@/app/cms/navigation/page";
import { CMSContentProvider, cmsContent, cmsNavigation } from "@/features/cms";
import { MediaCMSProvider } from "@/features/media-cms-simulation";
import { ProductCMSProvider } from "@/features/product-cms-simulation";
import { SiteConfigProvider } from "@/features/site-config-simulation";

function renderEditor(ui: React.ReactNode) {
  return render(<CMSContentProvider enabled>{ui}</CMSContentProvider>);
}

describe("CMS simulation", () => {
  it("renders the browser-only editor and complete navigation", async () => {
    const { container } = renderEditor(<Dashboard />);
    expect(await screen.findByLabelText("Hero headline")).toBeVisible();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByText("Browser-only simulation")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Save local content" }),
    ).toBeVisible();
    const nav = screen.getByRole("navigation", { name: "CMS" });
    for (const [, label] of cmsNavigation) expect(nav).toHaveTextContent(label);
  });

  it("renders homepage and marketing controls without publication", async () => {
    renderEditor(<Homepage />);
    expect(await screen.findByLabelText("Hero headline")).toBeVisible();
    expect(screen.getByLabelText("Primary CTA")).toBeVisible();
    expect(screen.getByLabelText("Hero sub-heading")).toBeVisible();
    expect(screen.getByLabelText("Show Trending products")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /publish/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the development product manager boundary", () => {
    render(
      <ProductCMSProvider enabled>
        <Products />
      </ProductCMSProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/restoring/i);
  });

  it("renders collection and category add/edit/visibility systems", () => {
    const first = render(<Collections />);
    expect(screen.getByLabelText("Collection name")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(
      cmsContent.collections.length,
    );
    first.unmount();
    render(<Categories />);
    expect(screen.getByLabelText("Category name")).toBeVisible();
    expect(screen.getAllByText("Featured / visible placeholder")).toHaveLength(
      cmsContent.categories.length,
    );
  });

  it("renders all banner preview slots", () => {
    render(<Banners />);
    expect(
      screen.getAllByRole("button", { name: "Preview banner" }),
    ).toHaveLength(4);
    expect(
      screen.getByRole("img", { name: "Dealer banner preview placeholder" }),
    ).toBeVisible();
  });

  it("renders searchable media library without uploads", async () => {
    render(
      <ProductCMSProvider enabled>
        <MediaCMSProvider enabled>
          <Media />
        </MediaCMSProvider>
      </ProductCMSProvider>,
    );
    expect(await screen.findByLabelText("Search media")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Upload unavailable" }),
    ).toBeDisabled();
    expect(
      screen.getAllByRole("button", { name: "Inspect" }).length,
    ).toBeGreaterThan(0);
  });

  it("renders plain blog editor and SEO fields", async () => {
    const first = render(<Blog />);
    expect(screen.getByLabelText("Article body")).toBeVisible();
    expect(screen.getAllByText("Draft")).toHaveLength(cmsContent.blogs.length);
    first.unmount();
    render(
      <SiteConfigProvider enabled>
        <SEO />
      </SiteConfigProvider>,
    );
    expect(await screen.findByLabelText("Canonical base URL")).toBeVisible();
    expect(screen.getByText("Metadata preview only")).toBeVisible();
  });

  it("renders theme manager without changing semantic tokens", () => {
    render(<Theme />);
    expect(screen.getByLabelText("Logo placeholder")).toBeDisabled();
    expect(screen.getByDisplayValue("Semantic ink token")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Button preview" }),
    ).toBeVisible();
  });

  it("renders header, footer and dealer navigation groups", async () => {
    render(
      <SiteConfigProvider enabled>
        <Navigation />
      </SiteConfigProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Navigation items" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Header logo text")).toBeVisible();
  });

  it("keeps CMS metadata private and uncached", () => {
    expect(cmsMetadata.robots).toMatchObject({
      index: false,
      follow: false,
      nocache: true,
    });
    expect(JSON.stringify(cmsMetadata)).not.toContain("https://");
  });
});
