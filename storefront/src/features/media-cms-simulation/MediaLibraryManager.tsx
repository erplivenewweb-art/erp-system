"use client";

import { useRef, useState, type FormEvent } from "react";
import { CMSHeader, CMSShell } from "@/features/cms";
import { useProductCMS } from "@/features/product-cms-simulation";
import { cloneMediaCMSContent, defaultMediaCMSContent } from "./defaults";
import { duplicateMedia, filterMedia, moveGalleryItem } from "./domain";
import { useMediaCMS } from "./MediaCMSProvider";
import type {
  MediaAssignmentGroup,
  MediaFilters,
  MediaItem,
  MediaKind,
} from "./types";
import styles from "./MediaLibrary.module.css";

const initialFilters: MediaFilters = {
  keyword: "",
  kind: "ALL",
  status: "ALL",
  usage: "ALL",
  recentOnly: false,
};
const KINDS: readonly MediaKind[] = [
  "PRODUCT_IMAGE",
  "GALLERY_IMAGE",
  "HOMEPAGE_BANNER",
  "CATEGORY_BANNER",
  "COLLECTION_BANNER",
  "LOGO",
  "PLACEHOLDER",
];
const EMPTY_GROUP: MediaAssignmentGroup = { bannerId: null, thumbnailId: null };

export function MediaLibraryManager() {
  const media = useMediaCMS();
  const products = useProductCMS();
  const [filters, setFilters] = useState(initialFilters);
  const [scope, setScope] = useState("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MediaItem | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [applying, setApplying] = useState(false);
  const [productId, setProductId] = useState(
    products.content.products[0]?.id ?? "",
  );
  const inspectorRef = useRef<HTMLElement>(null);
  const applyLockRef = useRef(false);

  const matchingItems = filterMedia(media.content.items, filters).filter(
    (item) =>
      scope === "ALL" ||
      (scope === "PRODUCT"
        ? ["PRODUCT_IMAGE", "GALLERY_IMAGE"].includes(item.kind)
        : item.kind === `${scope}_BANNER`),
  );
  const selectedItem = selectedId
    ? media.content.items.find((item) => item.id === selectedId)
    : undefined;
  const visible =
    selectedItem && !matchingItems.some((item) => item.id === selectedItem.id)
      ? [selectedItem, ...matchingItems]
      : matchingItems;
  const activeItems = media.content.items.filter(
    (item) => item.status === "ACTIVE",
  );
  const gallery = media.content.productGalleries[productId] ?? [];
  const select = (item: MediaItem) => {
    setSelectedId(item.id);
    setDraft(structuredClone(item));
    setIssues([]);
    setMessage(`Inspecting ${item.displayName}.`);
    queueMicrotask(() => inspectorRef.current?.focus());
  };
  const create = () => {
    const id = `media-local-${media.content.items.length + 1}`;
    select({
      id,
      displayName: "New media placeholder",
      alt: "New development media placeholder",
      caption: "Simulation-only media",
      placeholderUrl: `placeholder://media/${id}`,
      kind: "PLACEHOLDER",
      tags: ["development"],
      usageCount: 0,
      createdAt: "2026-08-03T00:00:00.000Z",
      updatedAt: "2026-08-03T00:00:00.000Z",
      status: "ACTIVE",
    });
  };
  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) {
      setIssues(["Select a media item before applying changes."]);
      setMessage("Media changes were not applied. Select a media item first.");
      return;
    }
    if (applyLockRef.current) return;
    const pendingDraft = structuredClone(draft);
    applyLockRef.current = true;
    setIssues([]);
    setMessage("Applying media changes…");
    setApplying(true);
    try {
      // Yield one task so the disabled/loading state is painted before the
      // synchronous localStorage commit runs.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      const result = media.applyItem(pendingDraft);
      const nextIssues = result.issues.map((issue) => issue.message);
      setIssues(nextIssues);
      if (result.item) {
        setDraft(result.item);
        setSelectedId(result.item.id);
        setMessage("Media changes applied and saved in this browser.");
      } else {
        setMessage(
          "Media changes were not applied. Resolve the validation errors.",
        );
      }
    } catch {
      setIssues(["Media changes could not be applied safely."]);
      setMessage("Media changes were not applied. Try again.");
    } finally {
      applyLockRef.current = false;
      setApplying(false);
    }
  };
  const duplicate = (item: MediaItem) => {
    const copy = duplicateMedia(item, media.content.items);
    const result = media.upsertItem(copy);
    if (!result.length) {
      select(copy);
      setMessage("Media placeholder duplicated.");
    }
  };
  const remove = (item: MediaItem) => {
    if (!media.deleteItem(item.id)) {
      setMessage("Used media cannot be deleted. Remove its references first.");
      return;
    }
    setSelectedId(null);
    setDraft(null);
    setMessage("Unused media removed.");
  };
  const setGallery = (ids: string[], resultMessage: string) => {
    if (media.setProductGallery(productId, ids)) setMessage(resultMessage);
    else
      setMessage(
        "Gallery must contain unique valid media and at least one primary item.",
      );
  };
  const galleryItems = gallery
    .map((id) => media.content.items.find((item) => item.id === id))
    .filter((item): item is MediaItem => Boolean(item));

  if (!media.enabled)
    return (
      <CMSShell>
        <CMSHeader
          eyebrow="Development only"
          title="Media library unavailable"
          description="The browser-only media simulation is disabled in this environment."
        />
      </CMSShell>
    );
  if (!media.hydrated)
    return (
      <CMSShell>
        <p role="status">Restoring media CMS simulation…</p>
      </CMSShell>
    );

  return (
    <CMSShell>
      <CMSHeader
        eyebrow="Browser-only asset simulation"
        title="Media library"
        description="Manage deterministic placeholders and references without uploads, filesystem access, APIs or production storage."
      />
      <div className={styles.statusBar}>
        <span>Persistence: {media.persistenceStatus}</span>
        <span>{media.dirty ? "Unsaved changes" : "Saved baseline"}</span>
        <strong>{media.content.items.length} media items</strong>
      </div>
      <p className={styles.message} role="status">
        {draft ? "" : message}
      </p>
      <div className={styles.actions}>
        <button
          className={styles.primary}
          onClick={() =>
            setMessage(
              media.save()
                ? "Media library saved in this browser."
                : "Media library could not be saved.",
            )
          }
          type="button"
        >
          Save media library
        </button>
        <button className={styles.button} onClick={create} type="button">
          Create placeholder
        </button>
        <button
          className={styles.button}
          onClick={() => {
            media.resetEverything();
            setMessage("Unsaved media changes reset to defaults.");
          }}
          type="button"
        >
          Reset everything
        </button>
        <button
          className={styles.button}
          onClick={() =>
            setMessage(
              media.restoreDefaults()
                ? "Media defaults restored."
                : "Defaults restored, but browser storage is unavailable.",
            )
          }
          type="button"
        >
          Restore defaults
        </button>
        <button
          aria-label="Upload unavailable"
          className={styles.button}
          disabled
          type="button"
        >
          Uploads unavailable
        </button>
      </div>
      <section aria-labelledby="media-grid-title" className={styles.panel}>
        <h2 id="media-grid-title">Media grid</h2>
        <div className={styles.toolbar}>
          <Field label="Search media">
            <input
              onChange={(event) =>
                setFilters({ ...filters, keyword: event.target.value })
              }
              value={filters.keyword}
            />
          </Field>
          <Field label="Media filter">
            <select
              onChange={(event) => setScope(event.target.value)}
              value={scope}
            >
              <option value="ALL">All media</option>
              <option value="PRODUCT">Product images</option>
              <option value="HOMEPAGE">Homepage</option>
              <option value="CATEGORY">Category</option>
              <option value="COLLECTION">Collection</option>
            </select>
          </Field>
          <Field label="Status">
            <select
              onChange={(event) =>
                setFilters({
                  ...filters,
                  status: event.target.value as MediaFilters["status"],
                })
              }
              value={filters.status}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </Field>
          <Field label="Usage">
            <select
              onChange={(event) =>
                setFilters({
                  ...filters,
                  usage: event.target.value as MediaFilters["usage"],
                })
              }
              value={filters.usage}
            >
              <option value="ALL">Any usage</option>
              <option value="USED">Used</option>
              <option value="UNUSED">Unused</option>
            </select>
          </Field>
          <label>
            <input
              checked={filters.recentOnly}
              onChange={(event) =>
                setFilters({ ...filters, recentOnly: event.target.checked })
              }
              type="checkbox"
            />{" "}
            Recently added
          </label>
          <button
            className={styles.button}
            onClick={() => {
              setFilters(initialFilters);
              setScope("ALL");
            }}
            type="button"
          >
            Clear media filters
          </button>
        </div>
        <p>{visible.length} results</p>
        <div className={styles.layout}>
          {visible.length ? (
            <div className={styles.grid}>
              {visible.map((item) => (
                <article
                  className={styles.mediaCard}
                  data-testid={`media-card-${item.id}`}
                  data-selected={selectedId === item.id}
                  key={item.id}
                >
                  <Placeholder item={item} />
                  <span className={styles.badge}>
                    {item.kind.replaceAll("_", " ")}
                  </span>
                  <h3>{item.displayName}</h3>
                  <p>{item.alt}</p>
                  {item.caption ? <p>{item.caption}</p> : null}
                  <p>{item.tags.length ? item.tags.join(", ") : "No tags"}</p>
                  <p>
                    {item.usageCount} references · {item.status}
                  </p>
                  <div className={styles.rowActions}>
                    <button
                      className={styles.button}
                      onClick={() => select(item)}
                      type="button"
                    >
                      Inspect
                    </button>
                    <button
                      className={styles.button}
                      onClick={() => duplicate(item)}
                      type="button"
                    >
                      Duplicate
                    </button>
                    <button
                      className={styles.danger}
                      disabled={item.usageCount > 0}
                      onClick={() => remove(item)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              No media matches these development filters.
            </p>
          )}
          <section
            aria-labelledby="media-inspector-title"
            className={`${styles.panel} ${styles.inspector}`}
            ref={inspectorRef}
            tabIndex={-1}
          >
            <h2 id="media-inspector-title">Media inspector</h2>
          {draft ? (
            <>
              <Placeholder item={draft} />
              <p>
                Created {draft.createdAt} · Updated {draft.updatedAt} · Usage{" "}
                {draft.usageCount}
              </p>
              {issues.length ? (
                  <div className={styles.error} role="alert">
                    <strong>Resolve media issues:</strong>
                    <ul>
                      {issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <form
                  aria-busy={applying}
                  id="media-inspector-form"
                  noValidate
                  onSubmit={saveDraft}
                >
                  <p aria-live="polite" className={styles.message} role="status">
                    {message}
                  </p>
                  <div className={styles.formGrid}>
                  <Field label="Media ID">
                    <input
                      disabled={media.content.items.some(
                        (item) => item.id === selectedId,
                      )}
                      onChange={(event) =>
                        setDraft({ ...draft, id: event.target.value })
                      }
                      value={draft.id}
                    />
                  </Field>
                  <Field label="Display name">
                    <input
                      maxLength={120}
                      onChange={(event) =>
                        setDraft({ ...draft, displayName: event.target.value })
                      }
                      value={draft.displayName}
                    />
                  </Field>
                  <Field label="Alt text">
                    <input
                      maxLength={180}
                      onChange={(event) =>
                        setDraft({ ...draft, alt: event.target.value })
                      }
                      value={draft.alt}
                    />
                  </Field>
                  <Field label="Caption">
                    <input
                      maxLength={240}
                      onChange={(event) =>
                        setDraft({ ...draft, caption: event.target.value })
                      }
                      value={draft.caption}
                    />
                  </Field>
                  <Field label="Placeholder URL">
                    <input
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          placeholderUrl: event.target.value,
                        })
                      }
                      value={draft.placeholderUrl}
                    />
                  </Field>
                  <Field label="Media category">
                    <select
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          kind: event.target.value as MediaKind,
                        })
                      }
                      value={draft.kind}
                    >
                      {KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Tags">
                    <input
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          tags: event.target.value.split(","),
                        })
                      }
                      value={draft.tags.join(", ")}
                    />
                  </Field>
                  <Field label="Media status">
                    <select
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          status: event.target.value as MediaItem["status"],
                        })
                      }
                      value={draft.status}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </Field>
                  </div>
                  <div className={styles.actions}>
                    <button
                      className={styles.primary}
                      disabled={applying}
                      form="media-inspector-form"
                      type="submit"
                    >
                      {applying ? "Applying media changes…" : "Apply media changes"}
                    </button>
                    <button
                      className={styles.button}
                      disabled={applying}
                      onClick={() => {
                        setDraft(null);
                        setSelectedId(null);
                        setIssues([]);
                      }}
                      type="button"
                    >
                      Cancel inspection
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <p>Select a media card to preview and inspect its metadata.</p>
            )}
          </section>
        </div>
      </section>
      <div className={styles.sections}>
        <section
          aria-labelledby="product-gallery-title"
          className={styles.panel}
        >
          <h2 id="product-gallery-title">Product gallery</h2>
          <Field label="Product">
            <select
              onChange={(event) => setProductId(event.target.value)}
              value={productId}
            >
              {products.content.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </Field>
          {galleryItems.map((item, index) => (
            <div className={styles.galleryRow} key={item.id}>
              <div>
                <strong>
                  {index === 0 ? "Primary · " : ""}
                  {item.displayName}
                </strong>
                <p>{item.alt}</p>
              </div>
              <div className={styles.rowActions}>
                <button
                  className={styles.button}
                  disabled={index === 0}
                  onClick={() =>
                    setGallery(
                      [item.id, ...gallery.filter((id) => id !== item.id)],
                      "Primary image updated.",
                    )
                  }
                  type="button"
                >
                  Set primary
                </button>
                <button
                  className={styles.button}
                  disabled={index === 0}
                  onClick={() =>
                    setGallery(
                      moveGalleryItem(gallery, item.id, -1),
                      "Gallery order updated.",
                    )
                  }
                  type="button"
                >
                  Move up
                </button>
                <button
                  className={styles.button}
                  disabled={index === gallery.length - 1}
                  onClick={() =>
                    setGallery(
                      moveGalleryItem(gallery, item.id, 1),
                      "Gallery order updated.",
                    )
                  }
                  type="button"
                >
                  Move down
                </button>
                <button
                  className={styles.button}
                  onClick={() =>
                    setMessage(
                      media.duplicateGalleryItem(productId, item.id)
                        ? "Gallery media duplicated."
                        : "Gallery media could not be duplicated.",
                    )
                  }
                  type="button"
                >
                  Duplicate
                </button>
                <button
                  className={styles.button}
                  disabled={gallery.length === 1}
                  onClick={() =>
                    setGallery(
                      gallery.filter((id) => id !== item.id),
                      "Gallery media removed.",
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
                <label>
                  <span className={styles.fieldLabel}>Replace</span>
                  <select
                    aria-label={`Replace ${item.displayName}`}
                    defaultValue=""
                    onChange={(event) => {
                      if (!event.target.value) return;
                      const next = [...gallery];
                      next[index] = event.target.value;
                      setGallery(next, "Gallery media replaced.");
                      event.target.value = "";
                    }}
                  >
                    <option value="">Choose media</option>
                    {activeItems
                      .filter((candidate) => !gallery.includes(candidate.id))
                      .map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.displayName}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  className={styles.button}
                  onClick={() => select(item)}
                  type="button"
                >
                  Preview
                </button>
              </div>
            </div>
          ))}
          <div className={styles.actions}>
            <Field label="Add or replace with media">
              <select
                defaultValue=""
                onChange={(event) => {
                  if (
                    event.target.value &&
                    !gallery.includes(event.target.value)
                  )
                    setGallery(
                      [...gallery, event.target.value],
                      "Media added to gallery.",
                    );
                  event.target.value = "";
                }}
              >
                <option value="">Choose active media</option>
                {activeItems
                  .filter((item) => !gallery.includes(item.id))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName}
                    </option>
                  ))}
              </select>
            </Field>
            <button
              className={styles.button}
              onClick={() =>
                setGallery(
                  defaultMediaCMSContent.productGalleries[productId] ??
                    cloneMediaCMSContent().productGalleries[productId] ??
                    gallery,
                  "Product gallery reset.",
                )
              }
              type="button"
            >
              Reset gallery
            </button>
          </div>
        </section>
        <HomepageAssignments />
        <TaxonomyAssignments kind="category" />
        <TaxonomyAssignments kind="collection" />
      </div>
    </CMSShell>
  );
}

function HomepageAssignments() {
  const media = useMediaCMS();
  const slots = [
    ["heroId", "CMS hero image"],
    ["featuredBannerId", "Featured banner"],
    ["festivalBannerId", "Festival banner"],
    ["announcementImageId", "Announcement image"],
  ] as const;
  return (
    <section aria-labelledby="homepage-media-title" className={styles.panel}>
      <h2 id="homepage-media-title">Homepage media</h2>
      <div className={styles.assignmentGrid}>
        {slots.map(([slot, label]) => (
          <MediaSelect
            key={slot}
            label={label}
            onChange={(id) => media.updateHomepage(slot, id)}
            value={media.content.homepage[slot]}
          />
        ))}
      </div>
    </section>
  );
}

function TaxonomyAssignments({ kind }: { kind: "category" | "collection" }) {
  const media = useMediaCMS();
  const products = useProductCMS();
  const entities =
    kind === "category"
      ? products.content.categories
      : products.content.collections;
  const assignments =
    kind === "category" ? media.content.categories : media.content.collections;
  const update =
    kind === "category" ? media.updateCategory : media.updateCollection;
  return (
    <section aria-labelledby={`${kind}-media-title`} className={styles.panel}>
      <h2 id={`${kind}-media-title`}>
        {kind === "category" ? "Category" : "Collection"} media
      </h2>
      {entities.map((entity) => {
        const group = assignments[entity.id] ?? EMPTY_GROUP;
        return (
          <fieldset className={styles.panel} key={entity.id}>
            <legend>{entity.name}</legend>
            <div className={styles.assignmentGrid}>
              <MediaSelect
                label="Banner"
                onChange={(id) => update(entity.id, { ...group, bannerId: id })}
                value={group.bannerId}
              />
              <MediaSelect
                label="Thumbnail"
                onChange={(id) =>
                  update(entity.id, { ...group, thumbnailId: id })
                }
                value={group.thumbnailId}
              />
              {kind === "category" ? (
                <>
                  <MediaSelect
                    label="Icon placeholder"
                    onChange={(id) =>
                      update(entity.id, { ...group, iconId: id })
                    }
                    value={group.iconId ?? null}
                  />
                  <MediaSelect
                    label="Description image"
                    onChange={(id) =>
                      update(entity.id, { ...group, descriptionImageId: id })
                    }
                    value={group.descriptionImageId ?? null}
                  />
                </>
              ) : (
                <MediaSelect
                  label="Cover image"
                  onChange={(id) =>
                    update(entity.id, { ...group, coverId: id })
                  }
                  value={group.coverId ?? null}
                />
              )}
            </div>
          </fieldset>
        );
      })}
    </section>
  );
}

function MediaSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange(id: string | null): void;
}) {
  const media = useMediaCMS();
  return (
    <Field label={label}>
      <select
        onChange={(event) => onChange(event.target.value || null)}
        value={value ?? ""}
      >
        <option value="">No media</option>
        {media.content.items
          .filter((item) => item.status === "ACTIVE")
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.displayName}
            </option>
          ))}
      </select>
    </Field>
  );
}
function Placeholder({ item }: { item: MediaItem }) {
  return (
    <div aria-label={item.alt} className={styles.placeholder} role="img">
      <strong>{item.displayName}</strong>
      <span>{item.placeholderUrl}</span>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}
