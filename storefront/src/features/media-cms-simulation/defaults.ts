import {
  developmentCategories,
  developmentProducts,
} from "@/features/catalogue-simulation/fixtures";
import {
  MEDIA_CMS_SCHEMA_VERSION,
  type MediaCMSContent,
  type MediaItem,
  type MediaKind,
} from "./types";

const CREATED = "2026-01-15T10:00:00.000Z";

function media(
  id: string,
  displayName: string,
  kind: MediaKind,
  tags: string[],
): MediaItem {
  return {
    id,
    displayName,
    alt: `${displayName} development placeholder`,
    caption: `${displayName} — simulated media`,
    placeholderUrl: `placeholder://media/${id}`,
    kind,
    tags,
    usageCount: 0,
    createdAt: CREATED,
    updatedAt: CREATED,
    status: "ACTIVE",
  };
}

const sharedItems: MediaItem[] = [
  media("media-hero-silver", "Silver Sankha hero", "HOMEPAGE_BANNER", [
    "homepage",
    "hero",
  ]),
  media(
    "media-featured-banner",
    "Featured collection banner",
    "HOMEPAGE_BANNER",
    ["homepage", "featured"],
  ),
  media("media-festival-banner", "Festival banner", "HOMEPAGE_BANNER", [
    "homepage",
    "festival",
  ]),
  media("media-announcement", "Announcement illustration", "HOMEPAGE_BANNER", [
    "homepage",
    "announcement",
  ]),
  media("media-logo-placeholder", "Silver Sankha logo", "LOGO", ["brand"]),
];

const productItems = developmentProducts.flatMap((product) =>
  product.media.map((image, index) => ({
    ...media(
      `media-cms-${product.id}-${index + 1}`,
      `${product.title} ${index === 0 ? "primary" : `gallery ${index + 1}`}`,
      index === 0 ? "PRODUCT_IMAGE" : "GALLERY_IMAGE",
      ["product", product.slug],
    ),
    alt: image.alt,
    caption: `${image.label} — development placeholder`,
  })),
);

const categoryItems = developmentCategories.flatMap((category) => [
  media(
    `media-${category.id}-banner`,
    `${category.title} banner`,
    "CATEGORY_BANNER",
    ["category", category.slug],
  ),
  media(
    `media-${category.id}-thumbnail`,
    `${category.title} thumbnail`,
    "CATEGORY_BANNER",
    ["category", "thumbnail"],
  ),
]);

const collections = [
  ["collection-featured", "Featured Collection", "featured"],
  ["collection-wedding", "Wedding Collection", "wedding"],
  ["collection-traditional", "Traditional", "traditional"],
  ["collection-festival", "Festival", "festival"],
  ["collection-new", "New Collection", "new-collection"],
  ["collection-seasonal", "Seasonal", "seasonal"],
] as const;

const collectionItems = collections.flatMap(([id, name, slug]) => [
  media(`media-${id}-banner`, `${name} banner`, "COLLECTION_BANNER", [
    "collection",
    slug,
  ]),
  media(`media-${id}-cover`, `${name} cover`, "COLLECTION_BANNER", [
    "collection",
    "cover",
  ]),
]);

const raw: MediaCMSContent = {
  version: MEDIA_CMS_SCHEMA_VERSION,
  items: [
    ...sharedItems,
    ...productItems,
    ...categoryItems,
    ...collectionItems,
  ],
  productGalleries: Object.fromEntries(
    developmentProducts.map((product) => [
      `cms-${product.id}`,
      product.media.map((_, index) => `media-cms-${product.id}-${index + 1}`),
    ]),
  ),
  homepage: {
    heroId: "media-hero-silver",
    featuredBannerId: "media-featured-banner",
    festivalBannerId: "media-festival-banner",
    announcementImageId: "media-announcement",
  },
  categories: Object.fromEntries(
    developmentCategories.map((category) => [
      category.id,
      {
        bannerId: `media-${category.id}-banner`,
        thumbnailId: `media-${category.id}-thumbnail`,
        iconId: null,
        descriptionImageId: null,
      },
    ]),
  ),
  collections: Object.fromEntries(
    collections.map(([id]) => [
      id,
      {
        bannerId: `media-${id}-banner`,
        thumbnailId: null,
        coverId: `media-${id}-cover`,
      },
    ]),
  ),
};

export const defaultMediaCMSContent = recountUsage(raw);

export function cloneMediaCMSContent(
  content: MediaCMSContent = defaultMediaCMSContent,
) {
  return structuredClone(content);
}

export function recountUsage(content: MediaCMSContent): MediaCMSContent {
  const counts = new Map<string, number>();
  const count = (id: string | null | undefined) => {
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  };
  Object.values(content.productGalleries).flat().forEach(count);
  Object.values(content.homepage).forEach(count);
  Object.values(content.categories).forEach((group) =>
    Object.values(group).forEach(count),
  );
  Object.values(content.collections).forEach((group) =>
    Object.values(group).forEach(count),
  );
  return {
    ...content,
    items: content.items.map((item) => ({
      ...item,
      usageCount: counts.get(item.id) ?? 0,
    })),
  };
}
