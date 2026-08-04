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
import { cloneProductCMSContent, defaultProductCMSContent } from "./defaults";
import {
  parseProductCMSContent,
  productCMSContentEqual,
  resetCategory,
  resetCategories,
  resetCollection,
  resetCollections,
  resetProduct,
  validateProduct,
} from "./domain";
import {
  clearProductCMSContent,
  persistProductCMSContent,
  restoreProductCMSContent,
} from "./persistence";
import {
  PRODUCT_CMS_STORAGE_KEY,
  type CMSManagedCategory,
  type CMSManagedCollection,
  type CMSManagedProduct,
  type ProductCMSContent,
  type ProductCMSPersistenceStatus,
  type ProductValidationIssue,
} from "./types";

interface ProductCMSContextValue {
  content: ProductCMSContent;
  enabled: boolean;
  hydrated: boolean;
  dirty: boolean;
  persistenceStatus: ProductCMSPersistenceStatus;
  upsertProduct(product: CMSManagedProduct): ProductValidationIssue[];
  deleteProduct(id: string): void;
  upsertCategory(category: CMSManagedCategory): void;
  deleteCategory(id: string): boolean;
  upsertCollection(collection: CMSManagedCollection): void;
  deleteCollection(id: string): boolean;
  resetProduct(id: string): void;
  resetCategory(id: string): void;
  resetCategories(): void;
  resetCollection(id: string): void;
  resetCollections(): void;
  resetEverything(): void;
  save(): boolean;
  restoreDefaults(): boolean;
}

const disabled: ProductCMSContextValue = {
  content: defaultProductCMSContent,
  enabled: false,
  hydrated: true,
  dirty: false,
  persistenceStatus: "disabled",
  upsertProduct: () => [
    { field: "environment", message: "Product CMS is disabled." },
  ],
  deleteProduct: () => undefined,
  upsertCategory: () => undefined,
  deleteCategory: () => false,
  upsertCollection: () => undefined,
  deleteCollection: () => false,
  resetProduct: () => undefined,
  resetCategory: () => undefined,
  resetCategories: () => undefined,
  resetCollection: () => undefined,
  resetCollections: () => undefined,
  resetEverything: () => undefined,
  save: () => false,
  restoreDefaults: () => false,
};

const ProductCMSContext = createContext<ProductCMSContextValue>(disabled);

export function ProductCMSProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const [content, setContent] = useState<ProductCMSContent>(
    defaultProductCMSContent,
  );
  const [saved, setSaved] = useState<ProductCMSContent>(
    defaultProductCMSContent,
  );
  const [hydrated, setHydrated] = useState(false);
  const [persistenceStatus, setPersistenceStatus] =
    useState<ProductCMSPersistenceStatus>(enabled ? "pending" : "disabled");

  useEffect(() => {
    queueMicrotask(() => {
      if (!enabled) {
        setHydrated(true);
        setPersistenceStatus("disabled");
        return;
      }
      const restored = restoreProductCMSContent(browserStorage());
      const initial = restored.content ?? cloneProductCMSContent();
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
      if (event.key !== PRODUCT_CMS_STORAGE_KEY) return;
      const restored = restoreProductCMSContent(browserStorage());
      const next = restored.content ?? cloneProductCMSContent();
      setContent(next);
      setSaved(next);
      setPersistenceStatus("ready");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [enabled, hydrated]);

  const dirty = !productCMSContentEqual(content, saved);
  useEffect(() => {
    if (!enabled || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, enabled]);

  const mutate = useCallback(
    (operation: (current: ProductCMSContent) => ProductCMSContent) => {
      if (enabled) setContent(operation);
    },
    [enabled],
  );

  const value = useMemo<ProductCMSContextValue>(
    () => ({
      content,
      enabled,
      hydrated,
      dirty,
      persistenceStatus,
      upsertProduct: (product) => {
        const normalized = {
          ...product,
          slug: product.slug.trim().toLowerCase(),
        };
        const issues = validateProduct(normalized, content.products);
        if (!issues.length)
          mutate((current) => ({
            ...current,
            products: current.products.some((item) => item.id === normalized.id)
              ? current.products.map((item) =>
                  item.id === normalized.id
                    ? structuredClone(normalized)
                    : item,
                )
              : [...current.products, structuredClone(normalized)],
          }));
        return issues;
      },
      deleteProduct: (id) =>
        mutate((current) => ({
          ...current,
          products: current.products.filter((item) => item.id !== id),
        })),
      upsertCategory: (category) =>
        mutate((current) => ({
          ...current,
          categories: current.categories.some((item) => item.id === category.id)
            ? current.categories.map((item) =>
                item.id === category.id ? structuredClone(category) : item,
              )
            : [...current.categories, structuredClone(category)],
        })),
      deleteCategory: (id) => {
        if (content.products.some((product) => product.categoryId === id))
          return false;
        mutate((current) => ({
          ...current,
          categories: current.categories.filter((item) => item.id !== id),
        }));
        return true;
      },
      upsertCollection: (collection) =>
        mutate((current) => ({
          ...current,
          collections: current.collections.some(
            (item) => item.id === collection.id,
          )
            ? current.collections.map((item) =>
                item.id === collection.id ? structuredClone(collection) : item,
              )
            : [...current.collections, structuredClone(collection)],
        })),
      deleteCollection: (id) => {
        if (content.products.some((product) => product.collectionId === id))
          return false;
        mutate((current) => ({
          ...current,
          collections: current.collections.filter((item) => item.id !== id),
        }));
        return true;
      },
      resetProduct: (id) => mutate((current) => resetProduct(current, id)),
      resetCategory: (id) => mutate((current) => resetCategory(current, id)),
      resetCategories: () => mutate(resetCategories),
      resetCollection: (id) =>
        mutate((current) => resetCollection(current, id)),
      resetCollections: () => mutate(resetCollections),
      resetEverything: () => mutate(() => cloneProductCMSContent()),
      save: () => {
        if (!enabled) return false;
        const validated = parseProductCMSContent(content);
        if (!validated) return false;
        const success = persistProductCMSContent(browserStorage(), validated);
        if (success) {
          setContent(validated);
          setSaved(validated);
          setPersistenceStatus("saved");
        } else setPersistenceStatus("unavailable");
        return success;
      },
      restoreDefaults: () => {
        if (!enabled) return false;
        const defaults = cloneProductCMSContent();
        const success = clearProductCMSContent(browserStorage());
        setContent(defaults);
        setSaved(defaults);
        setPersistenceStatus(success ? "saved" : "unavailable");
        return success;
      },
    }),
    [content, dirty, enabled, hydrated, mutate, persistenceStatus],
  );

  return (
    <ProductCMSContext.Provider value={value}>
      {children}
    </ProductCMSContext.Provider>
  );
}

export const useProductCMS = () => useContext(ProductCMSContext);

function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
