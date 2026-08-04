"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  cloneMediaCMSContent,
  defaultMediaCMSContent,
  recountUsage,
} from "./defaults";
import {
  duplicateMedia,
  mediaContentEqual,
  parseMediaCMSContent,
  validateMediaItem,
} from "./domain";
import {
  clearMediaCMSContent,
  persistMediaCMSContent,
  restoreMediaCMSContent,
} from "./persistence";
import {
  MEDIA_CMS_STORAGE_KEY,
  type MediaAssignmentGroup,
  type MediaCMSContent,
  type MediaItem,
  type MediaPersistenceStatus,
  type MediaValidationIssue,
} from "./types";

interface MediaCMSContextValue {
  content: MediaCMSContent;
  enabled: boolean;
  hydrated: boolean;
  dirty: boolean;
  persistenceStatus: MediaPersistenceStatus;
  upsertItem(item: MediaItem): MediaValidationIssue[];
  applyItem(item: MediaItem): {
    issues: MediaValidationIssue[];
    item: MediaItem | null;
  };
  deleteItem(id: string): boolean;
  setProductGallery(productId: string, ids: string[]): boolean;
  duplicateGalleryItem(productId: string, mediaId: string): boolean;
  updateHomepage(
    slot: keyof MediaCMSContent["homepage"],
    id: string | null,
  ): boolean;
  updateCategory(id: string, group: MediaAssignmentGroup): boolean;
  updateCollection(id: string, group: MediaAssignmentGroup): boolean;
  save(): boolean;
  resetEverything(): void;
  restoreDefaults(): boolean;
}

const disabled: MediaCMSContextValue = {
  content: defaultMediaCMSContent,
  enabled: false,
  hydrated: true,
  dirty: false,
  persistenceStatus: "disabled",
  upsertItem: () => [
    { field: "environment", message: "Media CMS is disabled." },
  ],
  applyItem: () => ({
    issues: [{ field: "environment", message: "Media CMS is disabled." }],
    item: null,
  }),
  deleteItem: () => false,
  setProductGallery: () => false,
  duplicateGalleryItem: () => false,
  updateHomepage: () => false,
  updateCategory: () => false,
  updateCollection: () => false,
  save: () => false,
  resetEverything: () => undefined,
  restoreDefaults: () => false,
};

const MediaCMSContext = createContext<MediaCMSContextValue>(disabled);
const UPDATED_AT = "2026-08-03T00:00:00.000Z";

export function MediaCMSProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const [content, setContent] = useState<MediaCMSContent>(
    defaultMediaCMSContent,
  );
  const [saved, setSaved] = useState<MediaCMSContent>(defaultMediaCMSContent);
  const [hydrated, setHydrated] = useState(false);
  const [persistenceStatus, setPersistenceStatus] =
    useState<MediaPersistenceStatus>(enabled ? "pending" : "disabled");

  useEffect(() => {
    queueMicrotask(() => {
      if (!enabled) {
        setHydrated(true);
        setPersistenceStatus("disabled");
        return;
      }
      const restored = restoreMediaCMSContent(browserStorage());
      const initial = restored.content ?? cloneMediaCMSContent();
      setContent(initial);
      setSaved(initial);
      setPersistenceStatus(
        restored.status === "invalid"
          ? "recovered"
          : restored.status === "unavailable"
            ? "unavailable"
            : "ready",
      );
      setHydrated(true);
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !hydrated) return;
    const sync = (event: StorageEvent) => {
      if (event.key !== MEDIA_CMS_STORAGE_KEY) return;
      const restored = restoreMediaCMSContent(browserStorage());
      const next = restored.content ?? cloneMediaCMSContent();
      setContent(next);
      setSaved(next);
      setPersistenceStatus("ready");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [enabled, hydrated]);

  const dirty = !mediaContentEqual(content, saved);
  useEffect(() => {
    if (!enabled || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, enabled]);

  const mutate = useCallback(
    (operation: (current: MediaCMSContent) => MediaCMSContent) => {
      if (enabled) setContent((current) => recountUsage(operation(current)));
    },
    [enabled],
  );
  const known = useCallback(
    (id: string | null) =>
      id === null || content.items.some((item) => item.id === id),
    [content.items],
  );

  const value = useMemo<MediaCMSContextValue>(
    () => ({
      content,
      enabled,
      hydrated,
      dirty,
      persistenceStatus,
      upsertItem: (item) => {
        const normalized = normalizeItem(item);
        const issues = validateMediaItem(normalized, content.items);
        if (!issues.length)
          mutate((current) => ({
            ...current,
            items: current.items.some((value) => value.id === normalized.id)
              ? current.items.map((value) =>
                  value.id === normalized.id
                    ? structuredClone(normalized)
                    : value,
                )
              : [...current.items, structuredClone(normalized)],
          }));
        return issues;
      },
      applyItem: (item) => {
        if (!enabled)
          return {
            issues: [
              { field: "environment", message: "Media CMS is disabled." },
            ],
            item: null,
          };
        const normalized = normalizeItem(item);
        const issues = validateMediaItem(normalized, content.items);
        if (issues.length) return { issues, item: null };
        const next = recountUsage({
          ...content,
          items: content.items.some((value) => value.id === normalized.id)
            ? content.items.map((value) =>
                value.id === normalized.id
                  ? structuredClone(normalized)
                  : value,
              )
            : [...content.items, structuredClone(normalized)],
        });
        const validated = parseMediaCMSContent(next);
        if (!validated)
          return {
            issues: [
              {
                field: "content",
                message: "Media changes failed aggregate validation.",
              },
            ],
            item: null,
          };
        if (!persistMediaCMSContent(browserStorage(), validated)) {
          setPersistenceStatus("unavailable");
          return {
            issues: [
              {
                field: "persistence",
                message:
                  "Media changes could not be saved in browser storage.",
              },
            ],
            item: null,
          };
        }
        const committed = validated.items.find(
          (value) => value.id === normalized.id,
        );
        setContent(validated);
        setSaved(validated);
        setPersistenceStatus("saved");
        return {
          issues: [],
          item: committed ? structuredClone(committed) : null,
        };
      },
      deleteItem: (id) => {
        const item = content.items.find((value) => value.id === id);
        if (!item || item.usageCount > 0) return false;
        mutate((current) => ({
          ...current,
          items: current.items.filter((value) => value.id !== id),
        }));
        return true;
      },
      setProductGallery: (productId, ids) => {
        if (
          !ids.length ||
          new Set(ids).size !== ids.length ||
          ids.some((id) => !known(id))
        )
          return false;
        mutate((current) => ({
          ...current,
          productGalleries: {
            ...current.productGalleries,
            [productId]: [...ids],
          },
        }));
        return true;
      },
      duplicateGalleryItem: (productId, mediaId) => {
        const source = content.items.find((item) => item.id === mediaId);
        const gallery = content.productGalleries[productId] ?? [];
        const index = gallery.indexOf(mediaId);
        if (!source || index < 0) return false;
        const copy = duplicateMedia(source, content.items);
        mutate((current) => ({
          ...current,
          items: [...current.items, copy],
          productGalleries: {
            ...current.productGalleries,
            [productId]: [
              ...gallery.slice(0, index + 1),
              copy.id,
              ...gallery.slice(index + 1),
            ],
          },
        }));
        return true;
      },
      updateHomepage: (slot, id) => {
        if (!known(id)) return false;
        mutate((current) => ({
          ...current,
          homepage: { ...current.homepage, [slot]: id },
        }));
        return true;
      },
      updateCategory: (id, group) => {
        if (Object.values(group).some((mediaId) => !known(mediaId)))
          return false;
        mutate((current) => ({
          ...current,
          categories: { ...current.categories, [id]: structuredClone(group) },
        }));
        return true;
      },
      updateCollection: (id, group) => {
        if (Object.values(group).some((mediaId) => !known(mediaId)))
          return false;
        mutate((current) => ({
          ...current,
          collections: { ...current.collections, [id]: structuredClone(group) },
        }));
        return true;
      },
      save: () => {
        if (!enabled) return false;
        const validated = parseMediaCMSContent(content);
        if (!validated) return false;
        const success = persistMediaCMSContent(browserStorage(), validated);
        if (success) {
          setContent(validated);
          setSaved(validated);
          setPersistenceStatus("saved");
        } else setPersistenceStatus("unavailable");
        return success;
      },
      resetEverything: () => mutate(() => cloneMediaCMSContent()),
      restoreDefaults: () => {
        if (!enabled) return false;
        const defaults = cloneMediaCMSContent();
        const success = clearMediaCMSContent(browserStorage());
        setContent(defaults);
        setSaved(defaults);
        setPersistenceStatus(success ? "saved" : "unavailable");
        return success;
      },
    }),
    [content, dirty, enabled, hydrated, known, mutate, persistenceStatus],
  );

  return (
    <MediaCMSContext.Provider value={value}>
      {children}
    </MediaCMSContext.Provider>
  );
}

export const useMediaCMS = () => useContext(MediaCMSContext);

function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeItem(item: MediaItem): MediaItem {
  return {
    ...item,
    id: item.id.trim().toLowerCase(),
    displayName: item.displayName.trim(),
    alt: item.alt.trim(),
    caption: item.caption.trim(),
    placeholderUrl: item.placeholderUrl.trim(),
    updatedAt: UPDATED_AT,
    tags: item.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
  };
}
