import { cloneMediaCMSContent, recountUsage } from "./defaults";
import {
  MEDIA_CMS_SCHEMA_VERSION,
  type MediaAssignmentGroup,
  type MediaCMSContent,
  type MediaFilters,
  type MediaItem,
  type MediaKind,
  type MediaStatus,
  type MediaValidationIssue,
} from "./types";

const KINDS: readonly MediaKind[] = [
  "PRODUCT_IMAGE",
  "GALLERY_IMAGE",
  "HOMEPAGE_BANNER",
  "CATEGORY_BANNER",
  "COLLECTION_BANNER",
  "LOGO",
  "PLACEHOLDER",
];
const STATUSES: readonly MediaStatus[] = ["ACTIVE", "ARCHIVED"];
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, max)
    : null;

export function validateMediaItem(
  item: MediaItem,
  items: readonly MediaItem[],
): MediaValidationIssue[] {
  const issues: MediaValidationIssue[] = [];
  if (!item.id.trim())
    issues.push({ field: "id", message: "Media ID is required." });
  if (
    items.some(
      (value) =>
        value.id !== item.id &&
        value.id.toLowerCase() === item.id.toLowerCase(),
    )
  )
    issues.push({ field: "id", message: "Media ID must be unique." });
  if (!item.displayName.trim())
    issues.push({ field: "displayName", message: "Display name is required." });
  if (!item.alt.trim())
    issues.push({ field: "alt", message: "Alt text is required." });
  if (!item.placeholderUrl.startsWith("placeholder://media/"))
    issues.push({
      field: "placeholderUrl",
      message: "Only placeholder://media URLs are allowed.",
    });
  if (
    items.some(
      (value) =>
        value.id !== item.id && value.placeholderUrl === item.placeholderUrl,
    )
  )
    issues.push({
      field: "placeholderUrl",
      message: "Placeholder URL must be unique.",
    });
  if (item.usageCount < 0 || !Number.isSafeInteger(item.usageCount))
    issues.push({ field: "usageCount", message: "Usage count is invalid." });
  return issues;
}

export function filterMedia(
  items: readonly MediaItem[],
  filters: MediaFilters,
) {
  const keyword = filters.keyword.trim().toLowerCase();
  return items
    .filter(
      (item) =>
        (!keyword ||
          [item.displayName, item.id, item.kind, ...item.tags]
            .join(" ")
            .toLowerCase()
            .includes(keyword)) &&
        (filters.kind === "ALL" || item.kind === filters.kind) &&
        (filters.status === "ALL" || item.status === filters.status) &&
        (filters.usage === "ALL" ||
          (filters.usage === "USED"
            ? item.usageCount > 0
            : item.usageCount === 0)) &&
        (!filters.recentOnly || item.createdAt >= "2026-01-01T00:00:00.000Z"),
    )
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName));
}

export function duplicateMedia(
  item: MediaItem,
  items: readonly MediaItem[],
): MediaItem {
  let suffix = 2;
  let id = `${item.id}-copy`;
  while (items.some((value) => value.id === id))
    id = `${item.id}-copy-${suffix++}`;
  return {
    ...structuredClone(item),
    id,
    displayName: `${item.displayName} Copy`.slice(0, 120),
    placeholderUrl: `placeholder://media/${id}`,
    usageCount: 0,
    createdAt: "2026-01-15T10:00:00.000Z",
    updatedAt: "2026-01-15T10:00:00.000Z",
  };
}

export function moveGalleryItem(
  ids: readonly string[],
  id: string,
  direction: -1 | 1,
) {
  const next = [...ids];
  const index = next.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function parseMediaCMSContent(value: unknown): MediaCMSContent | null {
  if (
    !record(value) ||
    value.version !== MEDIA_CMS_SCHEMA_VERSION ||
    !Array.isArray(value.items) ||
    !record(value.productGalleries) ||
    !record(value.homepage) ||
    !record(value.categories) ||
    !record(value.collections) ||
    value.items.length > 500
  )
    return null;
  const items = value.items.map(parseItem);
  if (items.some((item) => !item)) return null;
  const mediaItems = items as MediaItem[];
  if (
    new Set(mediaItems.map((item) => item.id)).size !== mediaItems.length ||
    new Set(mediaItems.map((item) => item.placeholderUrl)).size !==
      mediaItems.length ||
    mediaItems.some((item) => validateMediaItem(item, mediaItems).length)
  )
    return null;
  const ids = new Set(mediaItems.map((item) => item.id));
  const galleries = parseGalleries(value.productGalleries, ids);
  const homepage = parseHomepage(value.homepage, ids);
  const categories = parseGroups(value.categories, ids);
  const collections = parseGroups(value.collections, ids);
  if (!galleries || !homepage || !categories || !collections) return null;
  return recountUsage({
    version: MEDIA_CMS_SCHEMA_VERSION,
    items: mediaItems,
    productGalleries: galleries,
    homepage,
    categories,
    collections,
  });
}

function parseItem(value: unknown): MediaItem | null {
  if (
    !record(value) ||
    !KINDS.includes(value.kind as MediaKind) ||
    !STATUSES.includes(value.status as MediaStatus) ||
    !Array.isArray(value.tags)
  )
    return null;
  const id = text(value.id, 120),
    displayName = text(value.displayName, 120),
    alt = text(value.alt, 180),
    caption = text(value.caption, 240),
    placeholderUrl = text(value.placeholderUrl, 240),
    createdAt = text(value.createdAt, 40),
    updatedAt = text(value.updatedAt, 40);
  const tags = value.tags
    .map((tag) => text(tag, 40))
    .filter((tag): tag is string => Boolean(tag));
  if (
    !id ||
    !displayName ||
    !alt ||
    caption === null ||
    !placeholderUrl ||
    !createdAt ||
    !updatedAt ||
    tags.length > 20
  )
    return null;
  return {
    id,
    displayName,
    alt,
    caption,
    placeholderUrl,
    kind: value.kind as MediaKind,
    tags,
    usageCount: Number.isSafeInteger(value.usageCount)
      ? (value.usageCount as number)
      : 0,
    createdAt,
    updatedAt,
    status: value.status as MediaStatus,
  };
}

function parseGalleries(value: Record<string, unknown>, ids: Set<string>) {
  const result: Record<string, string[]> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (
      !Array.isArray(entry) ||
      entry.length > 20 ||
      entry.some((id) => typeof id !== "string" || !ids.has(id)) ||
      new Set(entry).size !== entry.length
    )
      return null;
    result[key] = [...entry];
  }
  return result;
}

function optionalId(value: unknown, ids: Set<string>) {
  return value === null
    ? null
    : typeof value === "string" && ids.has(value)
      ? value
      : undefined;
}
function parseHomepage(value: Record<string, unknown>, ids: Set<string>) {
  const heroId = optionalId(value.heroId, ids),
    featuredBannerId = optionalId(value.featuredBannerId, ids),
    festivalBannerId = optionalId(value.festivalBannerId, ids),
    announcementImageId = optionalId(value.announcementImageId, ids);
  return [heroId, featuredBannerId, festivalBannerId, announcementImageId].some(
    (id) => id === undefined,
  )
    ? null
    : {
        heroId: heroId!,
        featuredBannerId: featuredBannerId!,
        festivalBannerId: festivalBannerId!,
        announcementImageId: announcementImageId!,
      };
}
function parseGroups(value: Record<string, unknown>, ids: Set<string>) {
  const result: Record<string, MediaAssignmentGroup> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!record(entry)) return null;
    const bannerId = optionalId(entry.bannerId, ids);
    const thumbnailId = optionalId(entry.thumbnailId, ids);
    if (bannerId === undefined || thumbnailId === undefined) return null;
    const group: MediaAssignmentGroup = { bannerId, thumbnailId };
    for (const name of ["iconId", "descriptionImageId", "coverId"] as const)
      if (name in entry) {
        const id = optionalId(entry[name], ids);
        if (id === undefined) return null;
        group[name] = id;
      }
    result[key] = group;
  }
  return result;
}

export const mediaContentEqual = (a: MediaCMSContent, b: MediaCMSContent) =>
  JSON.stringify(a) === JSON.stringify(b);
export const resetMediaContent = () => cloneMediaCMSContent();
