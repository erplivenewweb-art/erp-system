import type {
  CatalogueProduct,
  ProductMedia,
} from "@/features/catalogue-simulation/types";
import type { HomeMedia } from "@/features/home/types";
import type { MediaCMSContent, MediaItem } from "./types";

export function findMedia(
  content: MediaCMSContent,
  id: string | null | undefined,
) {
  return id
    ? (content.items.find(
        (item) => item.id === id && item.status === "ACTIVE",
      ) ?? null)
    : null;
}

export function toProductMedia(item: MediaItem): ProductMedia {
  return {
    id: item.id,
    alt: item.alt,
    label: item.caption || item.displayName,
    aspectRatio: item.kind.includes("BANNER") ? "landscape" : "portrait",
    source: item.placeholderUrl,
  };
}

export function projectProductMedia<
  T extends Pick<CatalogueProduct, "id" | "media">,
>(product: T, content: MediaCMSContent): T {
  const keys = [product.id, `cms-${product.id}`];
  const ids = keys.map((key) => content.productGalleries[key]).find(Boolean);
  if (!ids?.length) return product;
  const media = ids
    .map((id) => findMedia(content, id))
    .filter((item): item is MediaItem => Boolean(item))
    .map(toProductMedia);
  return media.length ? ({ ...product, media } as T) : product;
}

export function projectHomeMedia(
  fallback: HomeMedia,
  content: MediaCMSContent,
  id: string | null,
): HomeMedia {
  const item = findMedia(content, id);
  return item
    ? { ...fallback, alt: item.alt, eyebrow: item.caption || item.displayName }
    : fallback;
}
