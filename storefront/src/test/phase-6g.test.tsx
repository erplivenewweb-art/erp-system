// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, describe, expect, it } from "vitest";
import { metadata as cmsMetadata } from "@/app/cms/page";
import {
  CMSContentProvider,
  CMSDashboard,
  CMS_SCHEMA_VERSION,
  CMS_STORAGE_KEY,
  cloneCMSContent,
  defaultCMSContent,
  parseCMSContent,
  persistCMSContent,
  resetHomepage,
  resetMarketing,
  restoreCMSContent,
} from "@/features/cms";
import { HomePage } from "@/features/home";

beforeEach(() => localStorage.clear());

describe("Phase 6G CMS domain and persistence", () => {
  it("validates and allowlists the versioned default content", () => {
    const content = parseCMSContent({
      ...cloneCMSContent(),
      ignored: "not retained",
    });
    expect(content).toEqual(defaultCMSContent);
    expect(content).not.toHaveProperty("ignored");
  });

  it("rejects old versions and malformed required content", () => {
    expect(
      parseCMSContent({
        ...cloneCMSContent(),
        version: CMS_SCHEMA_VERSION + 1,
      }),
    ).toBeNull();
    const malformed = cloneCMSContent();
    malformed.homepage.hero.title = "";
    expect(parseCMSContent(malformed)).toBeNull();
  });

  it("recovers malformed JSON and removes the unsafe record", () => {
    localStorage.setItem(CMS_STORAGE_KEY, "{broken");
    expect(restoreCMSContent(localStorage)).toEqual({
      status: "invalid",
      content: null,
    });
    expect(localStorage.getItem(CMS_STORAGE_KEY)).toBeNull();
  });

  it("handles unavailable and quota-failing storage", () => {
    expect(restoreCMSContent(null)).toEqual({
      status: "unavailable",
      content: null,
    });
    expect(
      persistCMSContent(
        {
          getItem: () => null,
          removeItem: () => undefined,
          setItem: () => {
            throw new DOMException("Quota exceeded", "QuotaExceededError");
          },
        },
        cloneCMSContent(),
      ),
    ).toBe(false);
  });

  it("resets homepage and marketing independently", () => {
    const changed = cloneCMSContent();
    changed.homepage.hero.title = "Changed hero";
    changed.marketing.wholesale.headline = "Changed wholesale";
    expect(resetHomepage(changed).homepage).toEqual(defaultCMSContent.homepage);
    expect(resetHomepage(changed).marketing.wholesale.headline).toBe(
      "Changed wholesale",
    );
    expect(resetMarketing(changed).marketing).toEqual(
      defaultCMSContent.marketing,
    );
    expect(resetMarketing(changed).homepage.hero.title).toBe("Changed hero");
  });
});

describe("Phase 6G CMS editor and live homepage", () => {
  it("updates live preview and the real homepage before Save", async () => {
    render(
      <CMSContentProvider enabled>
        <CMSDashboard />
        <HomePage />
      </CMSContentProvider>,
    );
    const headline = await screen.findByLabelText("Hero headline");
    fireEvent.change(headline, {
      target: { value: "A locally edited ceremonial story" },
    });
    expect(
      screen.getAllByRole("heading", {
        name: "A locally edited ceremonial story",
      }),
    ).toHaveLength(2);
    expect(screen.getByText("Unsaved changes")).toBeVisible();
    expect(localStorage.getItem(CMS_STORAGE_KEY)).toBeNull();
  });

  it("saves explicitly, resets drafts and restores defaults", async () => {
    const user = userEvent.setup();
    render(
      <CMSContentProvider enabled>
        <CMSDashboard />
      </CMSContentProvider>,
    );
    const field = await screen.findByLabelText("Hero headline");
    fireEvent.change(field, { target: { value: "Saved local headline" } });
    await user.click(
      screen.getByRole("button", { name: "Save local content" }),
    );
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem(CMS_STORAGE_KEY) ?? "{}").homepage.hero
          .title,
      ).toBe("Saved local headline"),
    );
    await user.click(screen.getByRole("button", { name: "Reset homepage" }));
    expect(field).toHaveValue(defaultCMSContent.homepage.hero.title);
    expect(screen.getByText("Unsaved changes")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Restore defaults" }));
    expect(localStorage.getItem(CMS_STORAGE_KEY)).toBeNull();
    expect(screen.getByText("All changes saved")).toBeVisible();
  });

  it("toggles announcement and section visibility through labelled controls", async () => {
    const user = userEvent.setup();
    render(
      <CMSContentProvider enabled>
        <CMSDashboard />
        <HomePage />
      </CMSContentProvider>,
    );
    const announcement = await screen.findByLabelText(
      "Enable announcement bar",
    );
    await user.click(announcement);
    expect(
      screen.queryByText(defaultCMSContent.marketing.announcement.text),
    ).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Show Featured collections"));
    expect(
      screen.queryByRole("heading", {
        name: defaultCMSContent.homepage.sections.collectionsTitle,
      }),
    ).not.toBeInTheDocument();
  });

  it("fails closed outside development and keeps CMS metadata private", () => {
    render(
      <CMSContentProvider enabled={false}>
        <CMSDashboard />
      </CMSContentProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "CMS simulation unavailable" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Hero headline")).not.toBeInTheDocument();
    expect(cmsMetadata.robots).toMatchObject({
      index: false,
      follow: false,
      nocache: true,
    });
  });

  it("has no automatic accessibility violations in the hydrated editor", async () => {
    const { container } = render(
      <CMSContentProvider enabled>
        <CMSDashboard />
      </CMSContentProvider>,
    );
    await screen.findByLabelText("Hero headline");
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
