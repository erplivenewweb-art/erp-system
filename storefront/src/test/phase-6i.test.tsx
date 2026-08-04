// @vitest-environment jsdom

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, describe, expect, it } from "vitest";
import { metadata } from "@/app/cms/media/page";
import {
  MEDIA_CMS_SCHEMA_VERSION,
  MEDIA_CMS_STORAGE_KEY,
  MediaCMSProvider,
  MediaLibraryManager,
  MediaReferencePreview,
  cloneMediaCMSContent,
  defaultMediaCMSContent,
  duplicateMedia,
  filterMedia,
  moveGalleryItem,
  parseMediaCMSContent,
  persistMediaCMSContent,
  restoreMediaCMSContent,
  useMediaCMS,
  validateMediaItem,
} from "@/features/media-cms-simulation";
import { ProductCMSProvider } from "@/features/product-cms-simulation";

beforeEach(() => localStorage.clear());

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ProductCMSProvider enabled>
      <MediaCMSProvider enabled>{children}</MediaCMSProvider>
    </ProductCMSProvider>
  );
}

describe("Phase 6I media domain", () => {
  it("allowlists deterministic defaults and recounts referenced media", () => {
    const parsed = parseMediaCMSContent({
      ...cloneMediaCMSContent(),
      ignored: true,
    });
    expect(parsed).toEqual(defaultMediaCMSContent);
    expect(parsed).not.toHaveProperty("ignored");
    expect(parsed!.items.some((item) => item.usageCount > 0)).toBe(true);
  });

  it("rejects duplicate IDs, placeholder URLs, missing alt text and broken references", () => {
    const content = cloneMediaCMSContent();
    const invalid = {
      ...content.items[0],
      id: "new-media",
      placeholderUrl: content.items[1].placeholderUrl,
      alt: "",
    };
    expect(
      validateMediaItem(invalid, content.items).map((issue) => issue.message),
    ).toEqual(
      expect.arrayContaining([
        "Placeholder URL must be unique.",
        "Alt text is required.",
      ]),
    );
    expect(
      parseMediaCMSContent({
        ...content,
        items: [...content.items, structuredClone(content.items[0])],
      }),
    ).toBeNull();
    expect(
      parseMediaCMSContent({
        ...content,
        homepage: { ...content.homepage, heroId: "missing-media" },
      }),
    ).toBeNull();
    expect(
      parseMediaCMSContent({
        ...content,
        productGalleries: {
          ...content.productGalleries,
          broken: ["missing-media"],
        },
      }),
    ).toBeNull();
  });

  it("duplicates deterministically, filters all required scopes and orders galleries", () => {
    const content = cloneMediaCMSContent();
    const item = content.items[0];
    const copy = duplicateMedia(item, content.items);
    expect(copy).toMatchObject({ id: `${item.id}-copy`, usageCount: 0 });
    expect(
      filterMedia(content.items, {
        keyword: "hero",
        kind: "HOMEPAGE_BANNER",
        status: "ACTIVE",
        usage: "USED",
        recentOnly: true,
      }).map((value) => value.id),
    ).toContain("media-hero-silver");
    expect(moveGalleryItem(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveGalleryItem(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
  });

  it("persists and recovers malformed, unsupported and quota-failed storage", () => {
    expect(persistMediaCMSContent(localStorage, cloneMediaCMSContent())).toBe(
      true,
    );
    expect(restoreMediaCMSContent(localStorage).content).toEqual(
      defaultMediaCMSContent,
    );
    localStorage.setItem(MEDIA_CMS_STORAGE_KEY, "{broken");
    expect(restoreMediaCMSContent(localStorage).status).toBe("invalid");
    localStorage.setItem(
      MEDIA_CMS_STORAGE_KEY,
      JSON.stringify({
        ...cloneMediaCMSContent(),
        version: MEDIA_CMS_SCHEMA_VERSION + 1,
      }),
    );
    expect(restoreMediaCMSContent(localStorage).status).toBe("invalid");
    expect(localStorage.getItem(MEDIA_CMS_STORAGE_KEY)).toBeNull();
    expect(
      persistMediaCMSContent(
        {
          getItem: () => null,
          removeItem: () => undefined,
          setItem: () => {
            throw new DOMException("Quota", "QuotaExceededError");
          },
        },
        cloneMediaCMSContent(),
      ),
    ).toBe(false);
    expect(restoreMediaCMSContent(null).status).toBe("unavailable");
  });
});

describe("Phase 6I media manager", () => {
  it("supports search, filters, inspection, validation, update, duplicate and create", async () => {
    render(
      <Providers>
        <MediaLibraryManager />
      </Providers>,
    );
    expect(
      await screen.findByRole("heading", { name: "Media library" }),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Search media"), {
      target: { value: "Silver Sankha hero" },
    });
    expect(screen.getByText("1 results")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
    expect(
      screen.getByRole("heading", { name: "Media inspector" }),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Updated hero placeholder" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Apply media changes" }),
    );
    expect(
      (await screen.findAllByText("Updated hero placeholder")).length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole("button", { name: "Clear media filters" }),
    );
    fireEvent.change(screen.getByLabelText("Media filter"), {
      target: { value: "PRODUCT" },
    });
    expect(
      screen.getAllByText(/PRODUCT IMAGE|GALLERY IMAGE/).length,
    ).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Usage"), {
      target: { value: "UNUSED" },
    });
    expect(screen.getByText(/results/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Create placeholder" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Apply media changes" }),
    );
    expect(
      await screen.findByText(
        "Media changes applied and saved in this browser.",
      ),
    ).toBeVisible();
  }, 15000);

  it("applies inspector edits atomically, persists across remount and rejects invalid input", async () => {
    const user = userEvent.setup();
    function ReferencedPreview() {
      const media = useMediaCMS();
      return (
        <MediaReferencePreview
          id={media.content.homepage.heroId}
          label="Referenced homepage hero"
        />
      );
    }

    const view = render(
      <Providers>
        <MediaLibraryManager />
        <ReferencedPreview />
      </Providers>,
    );
    await screen.findByRole("heading", { name: "Media library" });
    fireEvent.change(screen.getByLabelText("Search media"), {
      target: { value: "Silver Sankha hero" },
    });
    await user.click(screen.getByRole("button", { name: "Inspect" }));
    fireEvent.change(screen.getByLabelText("Alt text"), {
      target: { value: "Committed homepage hero alt" },
    });
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Committed homepage hero title" },
    });
    fireEvent.change(screen.getByLabelText("Caption"), {
      target: { value: "Committed homepage hero caption" },
    });
    fireEvent.change(screen.getByLabelText("Tags"), {
      target: { value: "homepage, committed" },
    });
    const applyButton = screen.getByRole("button", {
      name: "Apply media changes",
    });
    const inspectorForm = applyButton.closest("form");
    expect(inspectorForm).toBeInstanceOf(HTMLFormElement);
    if (!(inspectorForm instanceof HTMLFormElement))
      throw new Error("Media inspector form was not rendered.");
    expect(inspectorForm).toHaveAttribute("id", "media-inspector-form");
    expect(applyButton).toHaveAttribute("type", "submit");
    const nativeSubmitEvents: Event[] = [];
    inspectorForm.addEventListener("submit", (event) =>
      nativeSubmitEvents.push(event),
    );
    await act(async () => {
      inspectorForm.requestSubmit(applyButton);
    });
    expect(nativeSubmitEvents).toHaveLength(1);
    expect(nativeSubmitEvents[0]?.defaultPrevented).toBe(true);
    expect(inspectorForm).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("button", { name: "Applying media changes…" }),
    ).toBeDisabled();
    expect(
      await within(inspectorForm).findByText(
        "Media changes applied and saved in this browser.",
      ),
    ).toBeVisible();
    expect(inspectorForm).toHaveAttribute("aria-busy", "false");
    const committedCard = screen.getByTestId("media-card-media-hero-silver");
    expect(
      within(committedCard).getByRole("heading", {
        name: "Committed homepage hero title",
      }),
    ).toBeVisible();
    expect(
      within(committedCard).queryByRole("heading", {
        name: "Silver Sankha hero",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(committedCard).getByText("Committed homepage hero alt"),
    ).toBeVisible();
    expect(
      within(committedCard).getByText("Committed homepage hero caption"),
    ).toBeVisible();
    expect(
      within(committedCard).getByText("homepage, committed"),
    ).toBeVisible();
    expect(
      within(committedCard).getByText(
        (content) => content.includes("1 references") && content.includes("ACTIVE"),
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("Alt text")).toHaveValue(
      "Committed homepage hero alt",
    );
    expect(screen.getByLabelText("Caption")).toHaveValue(
      "Committed homepage hero caption",
    );
    expect(
      screen.getAllByRole("img", { name: "Committed homepage hero alt" })
        .length,
    ).toBeGreaterThanOrEqual(2);
    const persisted = JSON.parse(
      localStorage.getItem(MEDIA_CMS_STORAGE_KEY) ?? "null",
    );
    expect(
      persisted.items.find(
        (item: { id: string }) => item.id === "media-hero-silver",
      ),
    ).toMatchObject({
      alt: "Committed homepage hero alt",
      caption: "Committed homepage hero caption",
      displayName: "Committed homepage hero title",
      tags: ["homepage", "committed"],
    });

    fireEvent.change(screen.getByLabelText("Alt text"), {
      target: { value: " " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Apply media changes" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Alt text is required.",
    );
    expect(
      screen.getByText(
        "Media changes were not applied. Resolve the validation errors.",
      ),
    ).toBeVisible();
    expect(
      JSON.parse(localStorage.getItem(MEDIA_CMS_STORAGE_KEY) ?? "null").items.find(
        (item: { id: string }) => item.id === "media-hero-silver",
      ).alt,
    ).toBe("Committed homepage hero alt");

    view.unmount();
    render(
      <Providers>
        <ReferencedPreview />
      </Providers>,
    );
    expect(
      await screen.findByRole("img", { name: "Committed homepage hero alt" }),
    ).toHaveTextContent("Committed homepage hero caption");
  }, 15000);

  it("supports product primary, ordering, replacement, duplication, removal and reset controls", async () => {
    render(
      <Providers>
        <MediaLibraryManager />
      </Providers>,
    );
    await screen.findByRole("heading", { name: "Product gallery" });
    const gallery = screen
      .getByRole("heading", { name: "Product gallery" })
      .closest("section")!;
    expect(
      within(gallery).getAllByRole("button", { name: "Move down" }).length,
    ).toBeGreaterThan(0);
    const moveDown = within(gallery)
      .getAllByRole("button", { name: "Move down" })
      .find((button) => !button.hasAttribute("disabled"));
    if (moveDown) fireEvent.click(moveDown);
    expect(screen.getByText("Gallery order updated.")).toBeVisible();
    expect(
      within(gallery).getAllByRole("button", { name: "Set primary" }).length,
    ).toBeGreaterThan(0);
    expect(
      within(gallery).getAllByLabelText(/^Replace /).length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      within(gallery).getAllByRole("button", { name: "Duplicate" })[0],
    );
    expect(screen.getByText("Gallery media duplicated.")).toBeVisible();
    fireEvent.click(
      within(gallery).getByRole("button", { name: "Reset gallery" }),
    );
    expect(screen.getByText("Product gallery reset.")).toBeVisible();
  });

  it("synchronizes homepage, category and collection references without refresh", async () => {
    function SyncProbe() {
      const media = useMediaCMS();
      const replacement = media.content.items.find(
        (item) => item.id === "media-featured-banner",
      )!;
      return (
        <>
          <button
            onClick={() => media.updateHomepage("heroId", replacement.id)}
            type="button"
          >
            Change hero
          </button>
          <button
            onClick={() =>
              media.updateCategory("dev-category-sankha", {
                bannerId: replacement.id,
                thumbnailId: null,
              })
            }
            type="button"
          >
            Change category
          </button>
          <button
            onClick={() =>
              media.updateCollection("collection-featured", {
                bannerId: replacement.id,
                thumbnailId: null,
                coverId: replacement.id,
              })
            }
            type="button"
          >
            Change collection
          </button>
          <MediaReferencePreview
            id={media.content.homepage.heroId}
            label="Live hero"
          />
          <output>
            {media.content.categories["dev-category-sankha"]?.bannerId}
          </output>
          <output>
            {media.content.collections["collection-featured"]?.coverId}
          </output>
        </>
      );
    }
    render(
      <Providers>
        <SyncProbe />
      </Providers>,
    );
    await screen.findByRole("button", { name: "Change hero" });
    fireEvent.click(screen.getByRole("button", { name: "Change hero" }));
    expect(
      screen.getByRole("img", {
        name: "Featured collection banner development placeholder",
      }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Change category" }));
    fireEvent.click(screen.getByRole("button", { name: "Change collection" }));
    expect(screen.getAllByText("media-featured-banner")).toHaveLength(2);
  });

  it("is development-only, noindex and has no automatic accessibility violations", async () => {
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
      nocache: true,
    });
    const { container, rerender } = render(
      <ProductCMSProvider enabled>
        <MediaCMSProvider enabled={false}>
          <MediaLibraryManager />
        </MediaCMSProvider>
      </ProductCMSProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "Media library unavailable" }),
    ).toBeVisible();
    rerender(
      <Providers>
        <MediaLibraryManager />
      </Providers>,
    );
    await screen.findByRole("heading", { name: "Media library" });
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  }, 15000);
});
