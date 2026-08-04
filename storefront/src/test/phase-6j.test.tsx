// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, describe, expect, it } from "vitest";
import { metadata as announcementMetadata } from "@/app/cms/announcement/page";
import { PublicFooter, PublicHeader } from "@/components/public-shell";
import { CMSContentProvider } from "@/features/cms";
import {
  SITE_CONFIG_STORAGE_KEY,
  SITE_CONFIG_VERSION,
  SiteConfigManager,
  SiteConfigProvider,
  cloneSiteConfiguration,
  parseSiteConfiguration,
  persistSiteConfiguration,
  restoreSiteConfiguration,
} from "@/features/site-config-simulation";

beforeEach(() => localStorage.clear());
const Providers = ({ children }: { children: React.ReactNode }) => (
  <CMSContentProvider enabled>
    <SiteConfigProvider enabled>{children}</SiteConfigProvider>
  </CMSContentProvider>
);

describe("Phase 6J site configuration", () => {
  it("allowlists the versioned schema and rejects unsupported versions", () => {
    const parsed = parseSiteConfiguration({
      ...cloneSiteConfiguration(),
      ignored: "drop",
    });
    expect(parsed).not.toHaveProperty("ignored");
    expect(
      parseSiteConfiguration({
        ...cloneSiteConfiguration(),
        version: SITE_CONFIG_VERSION + 1,
      }),
    ).toBeNull();
  });
  it("recovers malformed and unavailable storage", () => {
    localStorage.setItem(SITE_CONFIG_STORAGE_KEY, "{bad");
    expect(restoreSiteConfiguration(localStorage).status).toBe("invalid");
    expect(localStorage.getItem(SITE_CONFIG_STORAGE_KEY)).toBeNull();
    expect(persistSiteConfiguration(null, cloneSiteConfiguration())).toBe(
      false,
    );
  });
  it("synchronizes navigation and header logo immediately", async () => {
    render(
      <Providers>
        <SiteConfigManager section="navigation" />
        <PublicHeader />
      </Providers>,
    );
    const logo = await screen.findByLabelText("Header logo text");
    fireEvent.change(logo, { target: { value: "Local Jewellery Studio" } });
    expect(
      screen.getByRole("link", { name: "Silver Sankha home" }),
    ).toHaveTextContent("Local Jewellery Studio");
    const visible = screen.getAllByLabelText("Visible")[0];
    await userEvent.click(visible);
    expect(
      screen.queryByRole("link", { name: "Home" }),
    ).not.toBeInTheDocument();
  });
  it("supports navigation create, duplicate, reorder and delete", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <SiteConfigManager section="navigation" />
      </Providers>,
    );
    await screen.findByLabelText("Header logo text");
    await user.click(
      screen.getByRole("button", { name: "Create navigation item" }),
    );
    expect(screen.getByDisplayValue("New link")).toBeVisible();
    const duplicate = screen.getAllByRole("button", { name: "Duplicate" })[0];
    await user.click(duplicate);
    expect(screen.getAllByDisplayValue(/Copy/).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole("button", { name: "Move down" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
  });
  it("updates footer and announcement public previews immediately", async () => {
    const view = render(
      <Providers>
        <SiteConfigManager section="footer" />
        <PublicFooter />
      </Providers>,
    );
    const company = await screen.findByLabelText("Company name");
    fireEvent.change(company, {
      target: { value: "Configured Jewellery House" },
    });
    expect(screen.getByText("Configured Jewellery House")).toBeVisible();
    fireEvent.change(screen.getAllByLabelText("Link label")[0], {
      target: { value: "Local privacy" },
    });
    expect(screen.getByRole("link", { name: "Local privacy" })).toBeVisible();
    view.unmount();
    render(
      <Providers>
        <SiteConfigManager section="announcement" />
        <PublicHeader />
      </Providers>,
    );
    const message = await screen.findByLabelText("Message");
    fireEvent.change(message, {
      target: { value: "Configured local announcement" },
    });
    expect(
      screen.getAllByText("Configured local announcement").length,
    ).toBeGreaterThanOrEqual(2);
  });
  it("previews SEO and persists across provider remount", async () => {
    const view = render(
      <Providers>
        <SiteConfigManager section="seo" />
      </Providers>,
    );
    const title = await screen.findByLabelText("Homepage title");
    fireEvent.change(title, { target: { value: "Configured SEO Preview" } });
    expect(screen.getByText("Configured SEO Preview")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem(SITE_CONFIG_STORAGE_KEY) ?? "{}").seo
          .homepageTitle,
      ).toBe("Configured SEO Preview"),
    );
    view.unmount();
    render(
      <Providers>
        <SiteConfigManager section="seo" />
      </Providers>,
    );
    expect(
      await screen.findByDisplayValue("Configured SEO Preview"),
    ).toBeVisible();
  });
  it("fails closed when disabled and keeps CMS pages private", () => {
    render(
      <SiteConfigProvider enabled={false}>
        <SiteConfigManager section="seo" />
      </SiteConfigProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "Site configuration unavailable" }),
    ).toBeVisible();
    expect(announcementMetadata.robots).toMatchObject({
      index: false,
      follow: false,
      nocache: true,
    });
  });
  it("has no automatic accessibility violations", async () => {
    const { container } = render(
      <Providers>
        <SiteConfigManager section="announcement" />
      </Providers>,
    );
    await screen.findByLabelText("Message");
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
