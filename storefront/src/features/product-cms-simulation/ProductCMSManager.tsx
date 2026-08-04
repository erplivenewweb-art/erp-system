"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { CMSShell, CMSHeader } from "@/features/cms";
import { duplicateProduct, filterProducts, normalizeSlug } from "./domain";
import { defaultProductCMSContent } from "./defaults";
import { projectCMSProduct } from "./projection";
import { useProductCMS } from "./ProductCMSProvider";
import type {
  CMSManagedCategory,
  CMSManagedCollection,
  CMSManagedProduct,
  ProductFilters,
  ProductStatus,
} from "./types";
import styles from "./ProductCMS.module.css";

const initialFilters: ProductFilters = {
  keyword: "",
  categoryId: "",
  collectionId: "",
  status: "ALL",
  flag: "ALL",
};

export function ProductCMSManager() {
  const cms = useProductCMS();
  const [filters, setFilters] = useState(initialFilters);
  const filtersRef = useRef(initialFilters);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<CMSManagedProduct | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const statusRef = useRef<HTMLParagraphElement>(null);
  const editorRef = useRef<HTMLElement>(null);
  const filtered = useMemo(
    () => filterProducts(cms.content.products, filters),
    [cms.content.products, filters],
  );

  useEffect(() => {
    if (!selectedId || !editorRef.current) return;
    editorRef.current.focus({ preventScroll: true });
    editorRef.current.scrollIntoView?.({ block: "start", behavior: "auto" });
  }, [selectedId]);

  function updateFilters(next: Partial<ProductFilters>) {
    const combined = { ...filtersRef.current, ...next };
    filtersRef.current = combined;
    setFilters(combined);
    if (
      selectedId &&
      !filterProducts(cms.content.products, combined).some(
        (product) => product.id === selectedId,
      )
    ) {
      setSelectedId("");
      setDraft(null);
      setIssues([]);
    }
  }

  function clearFilters() {
    filtersRef.current = initialFilters;
    setFilters(initialFilters);
  }

  function announce(value: string) {
    setMessage(value);
    queueMicrotask(() => statusRef.current?.focus());
  }
  function select(product: CMSManagedProduct) {
    setSelectedId(product.id);
    setDraft(structuredClone(product));
    setIssues([]);
  }
  function saveProduct(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const found = cms.upsertProduct({
      ...draft,
      slug: normalizeSlug(draft.slug),
    });
    setIssues(found.map((issue) => issue.message));
    if (!found.length)
      announce(
        "Product draft applied to the browser-only catalogue. Save all changes to persist it.",
      );
  }
  function changeStatus(status: ProductStatus) {
    if (!draft) return;
    const next = { ...draft, status };
    setDraft(next);
    const found = cms.upsertProduct(next);
    setIssues(found.map((issue) => issue.message));
    if (!found.length)
      announce(`Product status changed to ${status.toLowerCase()}.`);
  }
  function createProduct() {
    const source = cms.content.products[0];
    if (!source) return;
    const next = duplicateProduct(
      {
        ...source,
        name: "Untitled development product",
        slug: "untitled-development-product",
      },
      cms.content.products,
    );
    select(next);
    announce("New unsaved product draft created.");
  }

  if (!cms.enabled)
    return (
      <CMSShell>
        <CMSHeader
          eyebrow="Safe production posture"
          title="Product CMS unavailable"
          description="The browser-only product manager is disabled outside local development."
        />
        <div className={styles.empty} role="alert">
          No product editor, storage, API, upload, or backend fallback is
          active.
        </div>
      </CMSShell>
    );
  if (!cms.hydrated)
    return (
      <CMSShell>
        <p role="status">Restoring product CMS simulation…</p>
      </CMSShell>
    );

  return (
    <CMSShell>
      <CMSHeader
        eyebrow="Development product studio"
        title="Product management simulation"
        description="Manage fictional catalogue presentation locally. No ERP, inventory, order, upload, or publication service is connected."
      />
      <div className={styles.statusBar}>
        <span>{cms.content.products.length} products</span>
        <span>{cms.content.categories.length} categories</span>
        <span>{cms.content.collections.length} collections</span>
        <strong>{cms.dirty ? "Unsaved changes" : "All changes saved"}</strong>
        <span>Storage: {cms.persistenceStatus}</span>
      </div>
      <p
        aria-live="polite"
        className={styles.liveStatus}
        ref={statusRef}
        role="status"
        tabIndex={-1}
      >
        {message}
      </p>
      <div className={styles.primaryActions}>
        <button
          onClick={() =>
            announce(
              cms.save()
                ? "Product CMS content saved in this browser."
                : "Product CMS content could not be saved.",
            )
          }
          type="button"
        >
          Save all changes
        </button>
        <button onClick={createProduct} type="button">
          Create product
        </button>
        <button
          onClick={() => {
            cms.resetEverything();
            setDraft(null);
            announce(
              "Products, categories and collections reset. Save to persist.",
            );
          }}
          type="button"
        >
          Reset everything
        </button>
        <button
          onClick={() => {
            cms.restoreDefaults();
            setDraft(null);
            announce(
              "Default product CMS content restored and local storage cleared.",
            );
          }}
          type="button"
        >
          Restore defaults
        </button>
      </div>

      <section aria-labelledby="product-list-title" className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Catalogue records</p>
            <h2 id="product-list-title">Product list</h2>
          </div>
          <span aria-live="polite">{filtered.length} results</span>
        </div>
        <div className={styles.filters}>
          <Field label="Search products">
            <input
              onChange={(event) =>
                updateFilters({ keyword: event.target.value })
              }
              type="search"
              value={filters.keyword}
            />
          </Field>
          <Field label="Filter by category">
            <select
              onChange={(event) =>
                updateFilters({ categoryId: event.target.value })
              }
              value={filters.categoryId}
            >
              <option value="">All categories</option>
              {cms.content.categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Filter by collection">
            <select
              onChange={(event) =>
                updateFilters({ collectionId: event.target.value })
              }
              value={filters.collectionId}
            >
              <option value="">All collections</option>
              {cms.content.collections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Filter by status">
            <select
              onChange={(event) =>
                updateFilters({
                  status: event.target.value as ProductFilters["status"],
                })
              }
              value={filters.status}
            >
              <option value="ALL">All statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </Field>
          <Field label="Filter by merchandising">
            <select
              onChange={(event) =>
                updateFilters({
                  flag: event.target.value as ProductFilters["flag"],
                })
              }
              value={filters.flag}
            >
              <option value="ALL">All products</option>
              <option value="FEATURED">Featured</option>
              <option value="TRENDING">Trending</option>
              <option value="NEW_ARRIVAL">New arrival</option>
            </select>
          </Field>
          <button onClick={clearFilters} type="button">
            Clear filters
          </button>
        </div>
        <div className={styles.productList}>
          {filtered.length === 0 ? (
            <p className={styles.empty} role="status">
              No products match the active search and filters.
            </p>
          ) : null}
          {filtered.map((product) => (
            <article
              className={product.id === selectedId ? styles.selected : ""}
              key={product.id}
            >
              <div>
                <span className={styles.status} data-status={product.status}>
                  {product.status}
                </span>
                <h3>{product.name}</h3>
                <p>/{product.slug}</p>
              </div>
              <div className={styles.rowActions}>
                <button onClick={() => select(product)} type="button">
                  Edit
                </button>
                <button
                  onClick={() => {
                    const copy = duplicateProduct(
                      product,
                      cms.content.products,
                    );
                    cms.upsertProduct(copy);
                    select(copy);
                    announce("Product duplicated as a draft.");
                  }}
                  type="button"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => {
                    cms.deleteProduct(product.id);
                    if (selectedId === product.id) setDraft(null);
                    announce("Product removed from the local draft catalogue.");
                  }}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {draft ? (
        <ProductEditor
          categories={cms.content.categories}
          collections={cms.content.collections}
          containerRef={editorRef}
          draft={draft}
          issues={issues}
          onChange={setDraft}
          onCancel={() => {
            setSelectedId("");
            setDraft(null);
            setIssues([]);
            announce(
              "Product editing cancelled. Unapplied field changes were discarded.",
            );
          }}
          onReset={() => {
            cms.resetProduct(draft.id);
            const next = defaultProductCMSContent.products.find(
              (item) => item.sourceProductId === draft.sourceProductId,
            );
            if (next) setDraft(structuredClone(next));
            announce("Product reset requested.");
          }}
          onSave={saveProduct}
          onStatus={changeStatus}
        />
      ) : (
        <div className={styles.empty}>
          Select a product or create a new draft to open Product Details,
          Product Editor, and Product Preview.
        </div>
      )}

      <CategoryManager
        categories={cms.content.categories}
        onDelete={(id) => {
          const success = cms.deleteCategory(id);
          announce(
            success
              ? "Category deleted."
              : "Category is in use and cannot be deleted.",
          );
        }}
        onReset={() => {
          cms.resetCategories();
          announce("Categories reset. Save to persist.");
        }}
        onResetOne={(id) => {
          cms.resetCategory(id);
          announce("Category reset. Save to persist.");
        }}
        onSave={cms.upsertCategory}
      />
      <CollectionManager
        collections={cms.content.collections}
        onDelete={(id) => {
          const success = cms.deleteCollection(id);
          announce(
            success
              ? "Collection deleted."
              : "Collection is in use and cannot be deleted.",
          );
        }}
        onReset={() => {
          cms.resetCollections();
          announce("Collections reset. Save to persist.");
        }}
        onResetOne={(id) => {
          cms.resetCollection(id);
          announce("Collection reset. Save to persist.");
        }}
        onSave={cms.upsertCollection}
      />
    </CMSShell>
  );
}

function ProductEditor({
  categories,
  collections,
  containerRef,
  draft,
  issues,
  onChange,
  onCancel,
  onReset,
  onSave,
  onStatus,
}: {
  categories: CMSManagedCategory[];
  collections: CMSManagedCollection[];
  containerRef: RefObject<HTMLElement | null>;
  draft: CMSManagedProduct;
  issues: string[];
  onChange(value: CMSManagedProduct): void;
  onCancel(): void;
  onReset(): void;
  onSave(event: FormEvent): void;
  onStatus(value: ProductStatus): void;
}) {
  const projected = projectCMSProduct(draft, categories);
  const set = <K extends keyof CMSManagedProduct>(
    key: K,
    value: CMSManagedProduct[K],
  ) => onChange({ ...draft, [key]: value });
  return (
    <section
      aria-labelledby="product-editor-title"
      className={styles.editorGrid}
      ref={containerRef}
      tabIndex={-1}
    >
      <form className={styles.panel} noValidate onSubmit={onSave}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Product details</p>
            <h2 id="product-editor-title">Product editor</h2>
          </div>
          <button onClick={onReset} type="button">
            Reset product
          </button>
        </div>
        {issues.length ? (
          <div className={styles.errorSummary} role="alert">
            <strong>Resolve these validation issues:</strong>
            <ul>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className={styles.formGrid}>
          <Text
            label="Product name"
            maxLength={120}
            onChange={(value) => set("name", value)}
            value={draft.name}
          />
          <Text
            label="Slug"
            maxLength={80}
            onChange={(value) => set("slug", value)}
            value={draft.slug}
          />
          <Text
            area
            label="Short description"
            maxLength={180}
            onChange={(value) => set("shortDescription", value)}
            value={draft.shortDescription}
          />
          <Text
            area
            label="Long description"
            maxLength={1200}
            onChange={(value) => set("longDescription", value)}
            value={draft.longDescription}
          />
          <Field label="Category">
            <select
              onChange={(event) => set("categoryId", event.target.value)}
              value={draft.categoryId}
            >
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Collection">
            <select
              onChange={(event) => set("collectionId", event.target.value)}
              value={draft.collectionId}
            >
              {collections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <NumberField
            label="Simulated price (₹)"
            min={0}
            onChange={(value) => set("priceMinor", Math.round(value * 100))}
            value={draft.priceMinor / 100}
          />
          <NumberField
            label="MRP (₹)"
            min={0}
            onChange={(value) => set("mrpMinor", Math.round(value * 100))}
            value={draft.mrpMinor / 100}
          />
          <Text
            label="Tags (comma separated)"
            maxLength={400}
            onChange={(value) => set("tags", splitList(value))}
            value={draft.tags.join(", ")}
          />
          <NumberField
            label="Display order"
            min={0}
            onChange={(value) => set("displayOrder", Math.round(value))}
            value={draft.displayOrder}
          />
          <Text
            label="SEO title"
            maxLength={160}
            onChange={(value) => set("seoTitle", value)}
            value={draft.seoTitle}
          />
          <Text
            area
            label="SEO description"
            maxLength={320}
            onChange={(value) => set("seoDescription", value)}
            value={draft.seoDescription}
          />
          <Text
            label="SEO keywords (comma separated)"
            maxLength={400}
            onChange={(value) => set("seoKeywords", splitList(value))}
            value={draft.seoKeywords.join(", ")}
          />
        </div>
        <fieldset className={styles.flags}>
          <legend>Merchandising</legend>
          {(
            [
              ["featured", "Featured"],
              ["trending", "Trending"],
              ["newArrival", "New arrival"],
              ["bestSeller", "Best seller"],
              ["wholesaleAvailable", "Wholesale available"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <input
                checked={draft[key]}
                onChange={(event) => set(key, event.target.checked)}
                type="checkbox"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <ImageEditor draft={draft} onChange={onChange} />
        <div className={styles.primaryActions}>
          <button type="submit">Save product changes</button>
          <button onClick={onCancel} type="button">
            Cancel editing
          </button>
          <button onClick={() => onStatus("PUBLISHED")} type="button">
            Publish
          </button>
          <button onClick={() => onStatus("DRAFT")} type="button">
            Unpublish to draft
          </button>
          <button onClick={() => onStatus("ARCHIVED")} type="button">
            Archive
          </button>
        </div>
      </form>
      <aside
        aria-label="Product preview"
        className={`${styles.panel} ${styles.preview}`}
      >
        <p className={styles.eyebrow}>Product preview</p>
        <div
          aria-label={projected.media[0]?.alt}
          className={styles.imagePlaceholder}
          role="img"
        >
          {projected.media[0]?.label ?? "Image placeholder"}
        </div>
        <span className={styles.status}>{draft.status}</span>
        <h2>{projected.title}</h2>
        <p>{projected.subtitle}</p>
        <strong>{projected.price.label}</strong>
        <p>{projected.description}</p>
        <dl>
          <div>
            <dt>Category</dt>
            <dd>{projected.category.title}</dd>
          </div>
          <div>
            <dt>Wholesale</dt>
            <dd>{draft.wholesaleAvailable ? "Available" : "Not available"}</dd>
          </div>
        </dl>
      </aside>
    </section>
  );
}

function ImageEditor({
  draft,
  onChange,
}: {
  draft: CMSManagedProduct;
  onChange(value: CMSManagedProduct): void;
}) {
  const ordered = draft.images.toSorted((a, b) => a.order - b.order);
  const update = (
    id: string,
    next: Partial<CMSManagedProduct["images"][number]>,
  ) =>
    onChange({
      ...draft,
      images: draft.images.map((image) =>
        image.id === id ? { ...image, ...next } : image,
      ),
    });
  const makePrimary = (id: string) =>
    onChange({
      ...draft,
      images: draft.images.map((image) => ({
        ...image,
        primary: image.id === id,
      })),
    });
  const move = (id: string, direction: -1 | 1) => {
    const index = ordered.findIndex((item) => item.id === id);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({
      ...draft,
      images: next.map((image, order) => ({ ...image, order: order + 1 })),
    });
  };
  return (
    <fieldset className={styles.imageManager}>
      <legend>Image placeholders and gallery order</legend>
      {ordered.map((image, index) => (
        <div className={styles.imageRow} key={image.id}>
          <div
            className={styles.imagePlaceholder}
            role="img"
            aria-label={image.alt}
          >
            {image.placeholder}
          </div>
          <div>
            <Text
              label={`Image ${index + 1} alt text`}
              maxLength={180}
              onChange={(alt) => update(image.id, { alt })}
              value={image.alt}
            />
            <Text
              label={`Image ${index + 1} caption`}
              maxLength={180}
              onChange={(caption) => update(image.id, { caption })}
              value={image.caption}
            />
            <div className={styles.rowActions}>
              <button
                disabled={image.primary}
                onClick={() => makePrimary(image.id)}
                type="button"
              >
                {image.primary ? "Primary image" : "Set primary"}
              </button>
              <button
                disabled={index === 0}
                onClick={() => move(image.id, -1)}
                type="button"
              >
                Move up
              </button>
              <button
                disabled={index === ordered.length - 1}
                onClick={() => move(image.id, 1)}
                type="button"
              >
                Move down
              </button>
            </div>
          </div>
        </div>
      ))}
    </fieldset>
  );
}

function CategoryManager({
  categories,
  onDelete,
  onReset,
  onResetOne,
  onSave,
}: {
  categories: CMSManagedCategory[];
  onDelete(id: string): void;
  onReset(): void;
  onResetOne(id: string): void;
  onSave(value: CMSManagedCategory): void;
}) {
  const create = () =>
    onSave({
      id: `cms-category-${categories.length + 1}`,
      name: "New category",
      slug: `new-category-${categories.length + 1}`,
      description: "Development category description.",
      visible: false,
      homepageVisible: false,
      displayOrder: categories.length + 1,
    });
  return (
    <section aria-labelledby="category-manager-title" className={styles.panel}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Taxonomy</p>
          <h2 id="category-manager-title">Category manager</h2>
        </div>
        <div className={styles.rowActions}>
          <button onClick={create} type="button">
            Create category
          </button>
          <button onClick={onReset} type="button">
            Reset categories
          </button>
        </div>
      </div>
      <div className={styles.managementList}>
        {categories
          .toSorted((a, b) => a.displayOrder - b.displayOrder)
          .map((category) => (
            <EditableCategory
              category={category}
              key={category.id}
              onDelete={onDelete}
              onReset={onResetOne}
              onSave={onSave}
            />
          ))}
      </div>
    </section>
  );
}

function EditableCategory({
  category,
  onDelete,
  onReset,
  onSave,
}: {
  category: CMSManagedCategory;
  onDelete(id: string): void;
  onReset(id: string): void;
  onSave(value: CMSManagedCategory): void;
}) {
  const set = <K extends keyof CMSManagedCategory>(
    key: K,
    value: CMSManagedCategory[K],
  ) => onSave({ ...category, [key]: value });
  return (
    <article className={styles.managementRow}>
      <Text
        label={`${category.name} name`}
        maxLength={80}
        onChange={(value) => set("name", value)}
        value={category.name}
      />
      <Text
        area
        label={`${category.name} description`}
        maxLength={400}
        onChange={(value) => set("description", value)}
        value={category.description}
      />
      <NumberField
        label={`${category.name} display order`}
        min={0}
        onChange={(value) => set("displayOrder", Math.round(value))}
        value={category.displayOrder}
      />
      <label>
        <input
          checked={category.visible}
          onChange={(event) => set("visible", event.target.checked)}
          type="checkbox"
        />
        Visible
      </label>
      <label>
        <input
          checked={category.homepageVisible}
          onChange={(event) => set("homepageVisible", event.target.checked)}
          type="checkbox"
        />
        Homepage visibility
      </label>
      <button onClick={() => onDelete(category.id)} type="button">
        Delete category
      </button>
      <button onClick={() => onReset(category.id)} type="button">
        Reset category
      </button>
    </article>
  );
}

function CollectionManager({
  collections,
  onDelete,
  onReset,
  onResetOne,
  onSave,
}: {
  collections: CMSManagedCollection[];
  onDelete(id: string): void;
  onReset(): void;
  onResetOne(id: string): void;
  onSave(value: CMSManagedCollection): void;
}) {
  const create = () =>
    onSave({
      id: `cms-collection-${collections.length + 1}`,
      name: "New collection",
      slug: `new-collection-${collections.length + 1}`,
      description: "Development collection description.",
      kind: "NEW",
      featured: false,
      visible: false,
      displayOrder: collections.length + 1,
    });
  return (
    <section
      aria-labelledby="collection-manager-title"
      className={styles.panel}
    >
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Merchandising groups</p>
          <h2 id="collection-manager-title">Collection manager</h2>
        </div>
        <div className={styles.rowActions}>
          <button onClick={create} type="button">
            Create collection
          </button>
          <button onClick={onReset} type="button">
            Reset collections
          </button>
        </div>
      </div>
      <div className={styles.managementList}>
        {collections
          .toSorted((a, b) => a.displayOrder - b.displayOrder)
          .map((collection) => (
            <EditableCollection
              collection={collection}
              key={collection.id}
              onDelete={onDelete}
              onReset={onResetOne}
              onSave={onSave}
            />
          ))}
      </div>
    </section>
  );
}

function EditableCollection({
  collection,
  onDelete,
  onReset,
  onSave,
}: {
  collection: CMSManagedCollection;
  onDelete(id: string): void;
  onReset(id: string): void;
  onSave(value: CMSManagedCollection): void;
}) {
  const set = <K extends keyof CMSManagedCollection>(
    key: K,
    value: CMSManagedCollection[K],
  ) => onSave({ ...collection, [key]: value });
  return (
    <article className={styles.managementRow}>
      <Text
        label={`${collection.name} name`}
        maxLength={80}
        onChange={(value) => set("name", value)}
        value={collection.name}
      />
      <Text
        area
        label={`${collection.name} description`}
        maxLength={400}
        onChange={(value) => set("description", value)}
        value={collection.description}
      />
      <Field label={`${collection.name} collection type`}>
        <select
          onChange={(event) =>
            set("kind", event.target.value as CMSManagedCollection["kind"])
          }
          value={collection.kind}
        >
          {[
            "FEATURED",
            "WEDDING",
            "TRADITIONAL",
            "FESTIVAL",
            "NEW",
            "SEASONAL",
          ].map((kind) => (
            <option key={kind}>{kind}</option>
          ))}
        </select>
      </Field>
      <NumberField
        label={`${collection.name} display order`}
        min={0}
        onChange={(value) => set("displayOrder", Math.round(value))}
        value={collection.displayOrder}
      />
      <label>
        <input
          checked={collection.visible}
          onChange={(event) => set("visible", event.target.checked)}
          type="checkbox"
        />
        Visible
      </label>
      <label>
        <input
          checked={collection.featured}
          onChange={(event) => set("featured", event.target.checked)}
          type="checkbox"
        />
        Featured collection
      </label>
      <button onClick={() => onDelete(collection.id)} type="button">
        Delete collection
      </button>
      <button onClick={() => onReset(collection.id)} type="button">
        Reset collection
      </button>
    </article>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Text({
  area = false,
  label,
  maxLength,
  onChange,
  value,
}: {
  area?: boolean;
  label: string;
  maxLength: number;
  onChange(value: string): void;
  value: string;
}) {
  return (
    <Field label={label}>
      {area ? (
        <textarea
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      ) : (
        <input
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          type="text"
          value={value}
        />
      )}
    </Field>
  );
}
function NumberField({
  label,
  min,
  onChange,
  value,
}: {
  label: string;
  min: number;
  onChange(value: number): void;
  value: number;
}) {
  return (
    <Field label={label}>
      <input
        min={min}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        type="number"
        value={value}
      />
    </Field>
  );
}
const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
