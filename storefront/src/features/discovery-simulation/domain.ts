import type {
  CMSManagedCategory,
  CMSManagedCollection,
  CMSManagedProduct,
} from "@/features/product-cms-simulation";
import type { CatalogueProduct } from "@/features/catalogue-simulation/types";
import { projectCMSProduct } from "@/features/product-cms-simulation/projection";
import {
  DISCOVERY_SCHEMA_VERSION,
  MAX_COMPARE_PRODUCTS,
  MAX_RECENTLY_VIEWED,
  type DiscoveryFilters,
  type DiscoveryProduct,
  type DiscoverySort,
  type DiscoveryState,
} from "./types";

export const defaultDiscoveryFilters: DiscoveryFilters = {
  search: "",
  category: "",
  collection: "",
  minPrice: null,
  maxPrice: null,
  featured: false,
  trending: false,
  newArrival: false,
  wholesale: false,
  sort: "FEATURED",
};

export const defaultDiscoveryState: DiscoveryState = {
  version: DISCOVERY_SCHEMA_VERSION,
  recentSearches: [],
  recentlyViewed: [],
  comparison: [],
  filters: { ...defaultDiscoveryFilters },
  visibleCount: 6,
  scrollPosition: 0,
};

const sorts: readonly DiscoverySort[] = [
  "NEWEST",
  "OLDEST",
  "FEATURED",
  "TRENDING",
  "NAME_ASC",
  "NAME_DESC",
  "PRICE_ASC",
  "PRICE_DESC",
  "MOST_VIEWED",
  "MOST_POPULAR",
];

const text = (value: unknown, max = 80) =>
  typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, max)
    : "";
const finitePrice = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
const stringList = (value: unknown, maximum: number) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((item): item is string => typeof item === "string")
            .map((item) => text(item))
            .filter(Boolean),
        ),
      ].slice(0, maximum)
    : [];

export function parseDiscoveryState(value: unknown): DiscoveryState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<DiscoveryState>;
  if (candidate.version !== DISCOVERY_SCHEMA_VERSION) return null;
  const filters =
    candidate.filters && typeof candidate.filters === "object"
      ? candidate.filters
      : defaultDiscoveryFilters;
  return {
    version: DISCOVERY_SCHEMA_VERSION,
    recentSearches: stringList(candidate.recentSearches, 8),
    recentlyViewed: stringList(candidate.recentlyViewed, MAX_RECENTLY_VIEWED),
    comparison: stringList(candidate.comparison, MAX_COMPARE_PRODUCTS),
    filters: {
      search: text(filters.search),
      category: text(filters.category),
      collection: text(filters.collection),
      minPrice: finitePrice(filters.minPrice),
      maxPrice: finitePrice(filters.maxPrice),
      featured: filters.featured === true,
      trending: filters.trending === true,
      newArrival: filters.newArrival === true,
      wholesale: filters.wholesale === true,
      sort: sorts.includes(filters.sort as DiscoverySort)
        ? (filters.sort as DiscoverySort)
        : defaultDiscoveryFilters.sort,
    },
    visibleCount:
      typeof candidate.visibleCount === "number" &&
      Number.isInteger(candidate.visibleCount)
        ? Math.min(60, Math.max(6, candidate.visibleCount))
        : 6,
    scrollPosition:
      typeof candidate.scrollPosition === "number" &&
      Number.isFinite(candidate.scrollPosition)
        ? Math.max(0, candidate.scrollPosition)
        : 0,
  };
}

export function normalizeSearch(value: string) {
  return text(value);
}

const fallbackCollections = [
  "Traditional",
  "Wedding Collection",
  "Featured Collection",
  "Festival",
  "New Collection",
  "Seasonal",
] as const;

export function fixtureDiscoveryProducts(
  products: readonly CatalogueProduct[],
): DiscoveryProduct[] {
  return products.map((product, index) => ({
    product,
    collectionId: `fixture-${index % fallbackCollections.length}`,
    collectionName: fallbackCollections[index % fallbackCollections.length],
    featured: product.badges.includes("FEATURED"),
    trending: [0, 2, 5].includes(index),
    newArrival: product.badges.includes("NEW"),
    wholesale: product.b2bVisible,
    published: true,
    createdOrder: products.length - index,
    simulatedViews: 960 - index * 73,
    simulatedPopularity: 100 - index * 7 + (product.badges.length ? 12 : 0),
    searchTerms: [
      product.title,
      product.subtitle,
      product.category.title,
      product.purity,
    ],
  }));
}

export function cmsDiscoveryProducts(
  products: readonly CMSManagedProduct[],
  categories: readonly CMSManagedCategory[],
  collections: readonly CMSManagedCollection[],
): DiscoveryProduct[] {
  return products
    .filter((item) => item.status === "PUBLISHED")
    .map((item, index) => {
      const collection = collections.find(
        (candidate) => candidate.id === item.collectionId,
      );
      return {
        product: projectCMSProduct(item, categories),
        collectionId: item.collectionId,
        collectionName: collection?.name ?? "Unassigned collection",
        featured: item.featured,
        trending: item.trending,
        newArrival: item.newArrival,
        wholesale: item.wholesaleAvailable,
        published: true as const,
        createdOrder: products.length - index,
        simulatedViews: 960 - index * 73,
        simulatedPopularity:
          100 -
          index * 7 +
          (item.bestSeller ? 20 : 0) +
          (item.trending ? 12 : 0),
        searchTerms: [item.name, item.shortDescription, ...item.tags],
      };
    });
}

export function filterAndSortDiscoveryProducts(
  items: readonly DiscoveryProduct[],
  filters: DiscoveryFilters,
) {
  const keyword = normalizeSearch(filters.search).toLocaleLowerCase("en");
  const filtered = items.filter((item) => {
    const searchable = [
      ...item.searchTerms,
      item.collectionName,
      item.product.category.title,
    ]
      .join(" ")
      .toLocaleLowerCase("en");
    return (
      (!keyword || searchable.includes(keyword)) &&
      (!filters.category || item.product.category.slug === filters.category) &&
      (!filters.collection || item.collectionId === filters.collection) &&
      (filters.minPrice === null ||
        item.product.price.amount >= filters.minPrice) &&
      (filters.maxPrice === null ||
        item.product.price.amount <= filters.maxPrice) &&
      (!filters.featured || item.featured) &&
      (!filters.trending || item.trending) &&
      (!filters.newArrival || item.newArrival) &&
      (!filters.wholesale || item.wholesale)
    );
  });
  return filtered.toSorted((a, b) => {
    switch (filters.sort) {
      case "NEWEST":
        return b.createdOrder - a.createdOrder;
      case "OLDEST":
        return a.createdOrder - b.createdOrder;
      case "FEATURED":
        return (
          Number(b.featured) - Number(a.featured) ||
          b.simulatedPopularity - a.simulatedPopularity
        );
      case "TRENDING":
        return (
          Number(b.trending) - Number(a.trending) ||
          b.simulatedViews - a.simulatedViews
        );
      case "NAME_ASC":
        return a.product.title.localeCompare(b.product.title);
      case "NAME_DESC":
        return b.product.title.localeCompare(a.product.title);
      case "PRICE_ASC":
        return a.product.price.amount - b.product.price.amount;
      case "PRICE_DESC":
        return b.product.price.amount - a.product.price.amount;
      case "MOST_VIEWED":
        return b.simulatedViews - a.simulatedViews;
      case "MOST_POPULAR":
        return b.simulatedPopularity - a.simulatedPopularity;
    }
  });
}

export function deterministicRecommendations(
  current: DiscoveryProduct,
  items: readonly DiscoveryProduct[],
) {
  const others = items.filter((item) => item.product.id !== current.product.id);
  return {
    related: others
      .filter(
        (item) => item.product.category.id === current.product.category.id,
      )
      .slice(0, 3),
    alsoViewed: others
      .toSorted((a, b) => b.simulatedViews - a.simulatedViews)
      .slice(0, 3),
    recommended: others
      .toSorted((a, b) => {
        const aScore =
          Number(a.collectionId === current.collectionId) * 20 +
          a.simulatedPopularity;
        const bScore =
          Number(b.collectionId === current.collectionId) * 20 +
          b.simulatedPopularity;
        return bScore - aScore;
      })
      .slice(0, 3),
    trending: others.filter((item) => item.trending).slice(0, 3),
    newArrivals: others.filter((item) => item.newArrival).slice(0, 3),
  };
}
