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
import { beforeEach, describe, expect, it } from "vitest";
import { metadata as productCMSMetadata } from "@/app/cms/products/page";
import { HomepageCatalogue } from "@/features/home/HomepageCatalogue";
import {
  PRODUCT_CMS_SCHEMA_VERSION,
  PRODUCT_CMS_STORAGE_KEY,
  ProductCMSManager,
  ProductCMSProvider,
  cloneProductCMSContent,
  defaultProductCMSContent,
  duplicateProduct,
  filterProducts,
  parseProductCMSContent,
  persistProductCMSContent,
  restoreProductCMSContent,
  validateProduct,
} from "@/features/product-cms-simulation";

beforeEach(() => localStorage.clear());

describe("Phase 6H product CMS domain", () => {
  it("validates and allowlists deterministic defaults", () => {
    const parsed = parseProductCMSContent({
      ...cloneProductCMSContent(),
      ignored: true,
    });
    expect(parsed).toEqual(defaultProductCMSContent);
    expect(parsed).not.toHaveProperty("ignored");
  });

  it("rejects duplicate/reserved slugs, missing titles and invalid prices", () => {
    const content = cloneProductCMSContent();
    const invalid = {
      ...content.products[0],
      name: "",
      slug: "cms",
      priceMinor: -1,
      mrpMinor: -2,
    };
    const messages = validateProduct(invalid, content.products).map(
      (issue) => issue.message,
    );
    expect(messages).toEqual(
      expect.arrayContaining([
        "Product name is required.",
        "This slug is reserved.",
        "Price must be zero or greater.",
      ]),
    );
    const duplicate = {
      ...content.products[0],
      id: "another-id",
      slug: content.products[1].slug,
    };
    expect(
      validateProduct(duplicate, content.products).map(
        (issue) => issue.message,
      ),
    ).toContain("Slug must be unique.");
  });

  it("duplicates as a safe deterministic draft and filters every supported dimension", () => {
    const content = cloneProductCMSContent();
    const copy = duplicateProduct(content.products[0], content.products);
    expect(copy).toMatchObject({
      status: "DRAFT",
      slug: `${content.products[0].slug}-copy`,
      featured: false,
    });
    expect(copy.id).toBe(`cms-product-${copy.slug}`);
    const product = content.products[0];
    expect(
      filterProducts(content.products, {
        keyword: "heritage",
        categoryId: product.categoryId,
        collectionId: product.collectionId,
        status: "PUBLISHED",
        flag: "FEATURED",
      }),
    ).toEqual([product]);
  });

  it("persists safely and recovers malformed, unsupported and unavailable storage", () => {
    expect(
      persistProductCMSContent(localStorage, cloneProductCMSContent()),
    ).toBe(true);
    expect(restoreProductCMSContent(localStorage).content).toEqual(
      defaultProductCMSContent,
    );
    localStorage.setItem(PRODUCT_CMS_STORAGE_KEY, "{broken");
    expect(restoreProductCMSContent(localStorage).status).toBe("invalid");
    localStorage.setItem(
      PRODUCT_CMS_STORAGE_KEY,
      JSON.stringify({
        ...cloneProductCMSContent(),
        version: PRODUCT_CMS_SCHEMA_VERSION + 1,
      }),
    );
    expect(restoreProductCMSContent(localStorage).status).toBe("invalid");
    expect(localStorage.getItem(PRODUCT_CMS_STORAGE_KEY)).toBeNull();
    expect(restoreProductCMSContent(null).status).toBe("unavailable");
    expect(
      persistProductCMSContent(
        {
          getItem: () => null,
          removeItem: () => undefined,
          setItem: () => {
            throw new DOMException("Quota", "QuotaExceededError");
          },
        },
        cloneProductCMSContent(),
      ),
    ).toBe(false);
  });
});

describe("Phase 6H product manager", () => {
  it("renders details, editor, preview, search and lifecycle controls", async () => {
    render(
      <ProductCMSProvider enabled>
        <ProductCMSManager />
      </ProductCMSProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Product list" }),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Search products"), {
      target: { value: "heritage" },
    });
    expect(screen.getByText("1 results")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      screen.getByRole("heading", { name: "Product editor" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Product preview")).toBeVisible();
    expect(screen.getByLabelText("Product name")).toBeVisible();
    expect(screen.getByLabelText("Slug")).toBeVisible();
    expect(screen.getByLabelText("Simulated price (₹)")).toBeVisible();
    expect(screen.getByLabelText("Category")).toBeVisible();
    expect(screen.getByLabelText("Collection")).toBeVisible();
    expect(screen.getByLabelText("SEO title")).toBeVisible();
    expect(screen.getByRole("group", { name: "Merchandising" })).toBeVisible();
    expect(
      screen.getByRole("group", {
        name: "Image placeholders and gallery order",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Save product changes" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Cancel editing" }),
    ).toBeVisible();
    for (const name of ["Publish", "Unpublish to draft", "Archive"])
      expect(screen.getByRole("button", { name })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel editing" }));
    expect(
      screen.queryByRole("heading", { name: "Product editor" }),
    ).not.toBeInTheDocument();
  });

  it("filters the visible product list by every supported filter", async () => {
    const content = cloneProductCMSContent();
    content.products[0].status = "PUBLISHED";
    content.products[1].status = "DRAFT";
    content.products[2].status = "ARCHIVED";
    expect(persistProductCMSContent(localStorage, content)).toBe(true);
    render(
      <ProductCMSProvider enabled>
        <ProductCMSManager />
      </ProductCMSProvider>,
    );
    await screen.findByRole("heading", { name: "Product list" });
    const list = screen
      .getByRole("heading", { name: "Product list" })
      .closest("section")!;
    const visibleNames = () =>
      within(list)
        .queryAllByRole("article")
        .map((article) => within(article).getByRole("heading").textContent);
    const expectFilter = async (
      label: string,
      value: string,
      expected: string[],
    ) => {
      fireEvent.change(screen.getByLabelText(label), {
        target: { value },
      });
      await waitFor(() => expect(visibleNames()).toEqual(expected));
      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    };

    fireEvent.click(within(list).getAllByRole("button", { name: "Edit" })[0]);
    const polaCategory = content.categories.find(
      (item) => item.slug === "pola",
    )!;
    fireEvent.change(screen.getByLabelText("Filter by category"), {
      target: { value: polaCategory.id },
    });
    await waitFor(() =>
      expect(visibleNames()).toEqual(
        content.products
          .filter((item) => item.categoryId === polaCategory.id)
          .map((item) => item.name),
      ),
    );
    expect(
      screen.queryByRole("heading", { name: "Product editor" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    const traditional = content.collections.find(
      (item) => item.slug === "traditional",
    )!;
    await expectFilter(
      "Filter by collection",
      traditional.id,
      content.products
        .filter((item) => item.collectionId === traditional.id)
        .map((item) => item.name),
    );
    for (const status of ["PUBLISHED", "DRAFT", "ARCHIVED"] as const)
      await expectFilter(
        "Filter by status",
        status,
        content.products
          .filter((item) => item.status === status)
          .map((item) => item.name),
      );
    for (const [value, key] of [
      ["FEATURED", "featured"],
      ["TRENDING", "trending"],
      ["NEW_ARRIVAL", "newArrival"],
    ] as const)
      await expectFilter(
        "Filter by merchandising",
        value,
        content.products.filter((item) => item[key]).map((item) => item.name),
      );
  });

  it("applies edits and synchronizes homepage merchandising immediately", async () => {
    render(
      <ProductCMSProvider enabled>
        <ProductCMSManager />
        <HomepageCatalogue />
      </ProductCMSProvider>,
    );
    await screen.findByRole("heading", { name: "Product list" });
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    fireEvent.change(screen.getByLabelText("Product name"), {
      target: { value: "CMS Synced Heritage" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save product changes" }),
    );
    await waitFor(() =>
      expect(
        screen.getAllByRole("heading", { name: "CMS Synced Heritage" }).length,
      ).toBeGreaterThanOrEqual(2),
    );
    expect(localStorage.getItem(PRODUCT_CMS_STORAGE_KEY)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save all changes" }));
    await waitFor(() =>
      expect(localStorage.getItem(PRODUCT_CMS_STORAGE_KEY)).not.toBeNull(),
    );
  });

  it("supports publish, draft, archive, duplicate and delete workflows", async () => {
    const user = userEvent.setup();
    render(
      <ProductCMSProvider enabled>
        <ProductCMSManager />
      </ProductCMSProvider>,
    );
    await screen.findByRole("heading", { name: "Product list" });
    await user.click(screen.getByRole("button", { name: "Create product" }));
    expect(screen.getByLabelText("Product name")).toHaveValue(
      "Untitled development product Copy",
    );
    await user.click(
      screen.getByRole("button", { name: "Save product changes" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Unpublish to draft" }),
    );
    expect(screen.getByText("Product status changed to draft.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Publish" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(
      screen.getByText("Product status changed to archived."),
    ).toBeVisible();
    const list = screen
      .getByRole("heading", { name: "Product list" })
      .closest("section")!;
    await user.click(
      within(list).getAllByRole("button", { name: "Duplicate" })[0],
    );
    const before = within(list).getAllByRole("button", {
      name: "Delete",
    }).length;
    await user.click(
      within(list).getAllByRole("button", { name: "Delete" }).at(-1)!,
    );
    expect(
      within(list).getAllByRole("button", { name: "Delete" }),
    ).toHaveLength(before - 1);
  });

  it("creates and resets category/collection records and edits image metadata", async () => {
    const user = userEvent.setup();
    render(
      <ProductCMSProvider enabled>
        <ProductCMSManager />
      </ProductCMSProvider>,
    );
    await screen.findByRole("heading", { name: "Category manager" });
    await user.click(screen.getByRole("button", { name: "Create category" }));
    expect(screen.getByLabelText("New category name")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Create collection" }));
    expect(screen.getByLabelText("New collection name")).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    const alt = screen.getByLabelText("Image 1 alt text");
    fireEvent.change(alt, {
      target: { value: "Updated simulated primary image" },
    });
    expect(alt).toHaveValue("Updated simulated primary image");
    expect(
      screen.getByRole("button", { name: "Primary image" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Reset product" }));
    expect(screen.getByLabelText("Image 1 alt text")).not.toHaveValue(
      "Updated simulated primary image",
    );
    await user.click(screen.getByRole("button", { name: "Reset categories" }));
    await user.click(screen.getByRole("button", { name: "Reset collections" }));
    expect(
      screen.getByText("Collections reset. Save to persist."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reset everything" }));
    await user.click(screen.getByRole("button", { name: "Restore defaults" }));
    expect(localStorage.getItem(PRODUCT_CMS_STORAGE_KEY)).toBeNull();
  });

  it("fails closed outside development and keeps product CMS private", () => {
    render(
      <ProductCMSProvider enabled={false}>
        <ProductCMSManager />
      </ProductCMSProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "Product CMS unavailable" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Create product" }),
    ).not.toBeInTheDocument();
    expect(productCMSMetadata.robots).toMatchObject({
      index: false,
      follow: false,
      nocache: true,
    });
  });

  it("has no automatic accessibility violations in the hydrated manager", async () => {
    const { container } = render(
      <ProductCMSProvider enabled>
        <ProductCMSManager />
      </ProductCMSProvider>,
    );
    await screen.findByRole("heading", { name: "Product list" });
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
