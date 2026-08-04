export const PRODUCT_CMS_SCHEMA_VERSION = 1;
export const PRODUCT_CMS_STORAGE_KEY =
  "silver-sankha-development-product-cms-v1";

export type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type CollectionKind =
  "FEATURED" | "WEDDING" | "TRADITIONAL" | "FESTIVAL" | "NEW" | "SEASONAL";

export interface CMSProductImage {
  id: string;
  placeholder: string;
  alt: string;
  caption: string;
  primary: boolean;
  order: number;
}

export interface CMSManagedProduct {
  id: string;
  sourceProductId: string;
  name: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  categoryId: string;
  collectionId: string;
  priceMinor: number;
  mrpMinor: number;
  tags: string[];
  featured: boolean;
  trending: boolean;
  newArrival: boolean;
  bestSeller: boolean;
  wholesaleAvailable: boolean;
  displayOrder: number;
  status: ProductStatus;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  images: CMSProductImage[];
}

export interface CMSManagedCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  visible: boolean;
  homepageVisible: boolean;
  displayOrder: number;
}

export interface CMSManagedCollection {
  id: string;
  name: string;
  slug: string;
  description: string;
  kind: CollectionKind;
  featured: boolean;
  visible: boolean;
  displayOrder: number;
}

export interface ProductCMSContent {
  version: typeof PRODUCT_CMS_SCHEMA_VERSION;
  products: CMSManagedProduct[];
  categories: CMSManagedCategory[];
  collections: CMSManagedCollection[];
}

export type ProductCMSPersistenceStatus =
  "pending" | "ready" | "saved" | "recovered" | "unavailable" | "disabled";

export interface ProductFilters {
  keyword: string;
  categoryId: string;
  collectionId: string;
  status: "ALL" | ProductStatus;
  flag: "ALL" | "FEATURED" | "TRENDING" | "NEW_ARRIVAL";
}

export interface ProductValidationIssue {
  field: string;
  message: string;
}
