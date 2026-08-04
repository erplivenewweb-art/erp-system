export const MEDIA_CMS_SCHEMA_VERSION = 1;
export const MEDIA_CMS_STORAGE_KEY = "silver-sankha-development-media-cms-v1";

export type MediaKind =
  | "PRODUCT_IMAGE"
  | "GALLERY_IMAGE"
  | "HOMEPAGE_BANNER"
  | "CATEGORY_BANNER"
  | "COLLECTION_BANNER"
  | "LOGO"
  | "PLACEHOLDER";
export type MediaStatus = "ACTIVE" | "ARCHIVED";

export interface MediaItem {
  id: string;
  displayName: string;
  alt: string;
  caption: string;
  placeholderUrl: string;
  kind: MediaKind;
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  status: MediaStatus;
}

export interface MediaAssignmentGroup {
  bannerId: string | null;
  thumbnailId: string | null;
  iconId?: string | null;
  descriptionImageId?: string | null;
  coverId?: string | null;
}

export interface MediaCMSContent {
  version: typeof MEDIA_CMS_SCHEMA_VERSION;
  items: MediaItem[];
  productGalleries: Record<string, string[]>;
  homepage: {
    heroId: string | null;
    featuredBannerId: string | null;
    festivalBannerId: string | null;
    announcementImageId: string | null;
  };
  categories: Record<string, MediaAssignmentGroup>;
  collections: Record<string, MediaAssignmentGroup>;
}

export type MediaPersistenceStatus =
  | "pending"
  | "ready"
  | "saved"
  | "recovered"
  | "unavailable"
  | "disabled";

export interface MediaFilters {
  keyword: string;
  kind: "ALL" | MediaKind;
  status: "ALL" | MediaStatus;
  usage: "ALL" | "USED" | "UNUSED";
  recentOnly: boolean;
}

export interface MediaValidationIssue {
  field: string;
  message: string;
}
