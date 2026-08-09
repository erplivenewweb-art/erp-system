import type { CatalogueProduct } from "@/features/catalogue-simulation/types";

export const DISCOVERY_SCHEMA_VERSION = 1;
export const DISCOVERY_STORAGE_KEY = "silver-sankha-development-discovery-v1";
export const MAX_RECENTLY_VIEWED = 20;
export const MAX_COMPARE_PRODUCTS = 4;

export type DiscoverySort =
  | "NEWEST"
  | "OLDEST"
  | "FEATURED"
  | "TRENDING"
  | "NAME_ASC"
  | "NAME_DESC"
  | "PRICE_ASC"
  | "PRICE_DESC"
  | "MOST_VIEWED"
  | "MOST_POPULAR";

export interface DiscoveryFilters {
  search: string;
  category: string;
  collection: string;
  minPrice: number | null;
  maxPrice: number | null;
  featured: boolean;
  trending: boolean;
  newArrival: boolean;
  wholesale: boolean;
  sort: DiscoverySort;
}

export interface DiscoveryState {
  version: typeof DISCOVERY_SCHEMA_VERSION;
  recentSearches: string[];
  recentlyViewed: string[];
  comparison: string[];
  filters: DiscoveryFilters;
  visibleCount: number;
  scrollPosition: number;
}

export interface DiscoveryProduct {
  product: CatalogueProduct;
  collectionId: string;
  collectionName: string;
  featured: boolean;
  trending: boolean;
  newArrival: boolean;
  wholesale: boolean;
  published: true;
  createdOrder: number;
  simulatedViews: number;
  simulatedPopularity: number;
  searchTerms: readonly string[];
}

export type DiscoveryPersistenceStatus =
  "pending" | "ready" | "saved" | "recovered" | "unavailable" | "disabled";
