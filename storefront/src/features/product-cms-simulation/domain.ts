import { cloneProductCMSContent, defaultProductCMSContent } from "./defaults";
import {
  PRODUCT_CMS_SCHEMA_VERSION,
  type CMSManagedCategory,
  type CMSManagedCollection,
  type CMSManagedProduct,
  type ProductCMSContent,
  type ProductFilters,
  type ProductStatus,
  type ProductValidationIssue,
} from "./types";

const RESERVED_SLUGS = new Set([
  "account",
  "cart",
  "checkout",
  "cms",
  "products",
  "wishlist",
]);
const STATUSES: readonly ProductStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const COLLECTION_KINDS = [
  "FEATURED",
  "WEDDING",
  "TRADITIONAL",
  "FESTIVAL",
  "NEW",
  "SEASONAL",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, max)
    : null;
const boolean = (value: unknown) => (typeof value === "boolean" ? value : null);
const integer = (value: unknown, min = 0) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min
    ? value
    : null;
const stringList = (value: unknown, maxItems: number, maxLength: number) =>
  Array.isArray(value) && value.length <= maxItems
    ? value
        .map((item) => text(item, maxLength))
        .filter((item): item is string => Boolean(item))
    : null;

export function normalizeSlug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function validateProduct(
  product: CMSManagedProduct,
  products: readonly CMSManagedProduct[],
): ProductValidationIssue[] {
  const issues: ProductValidationIssue[] = [];
  if (!product.name.trim())
    issues.push({ field: "name", message: "Product name is required." });
  if (product.name.length > 120)
    issues.push({ field: "name", message: "Product name is too long." });
  const slug = normalizeSlug(product.slug);
  if (!slug) issues.push({ field: "slug", message: "Slug is required." });
  if (RESERVED_SLUGS.has(slug))
    issues.push({ field: "slug", message: "This slug is reserved." });
  if (
    products.some(
      (item) => item.id !== product.id && normalizeSlug(item.slug) === slug,
    )
  )
    issues.push({ field: "slug", message: "Slug must be unique." });
  if (!Number.isSafeInteger(product.priceMinor) || product.priceMinor < 0)
    issues.push({
      field: "priceMinor",
      message: "Price must be zero or greater.",
    });
  if (
    !Number.isSafeInteger(product.mrpMinor) ||
    product.mrpMinor < product.priceMinor
  )
    issues.push({
      field: "mrpMinor",
      message: "MRP must be at least the simulated price.",
    });
  if (
    product.shortDescription.length > 180 ||
    product.longDescription.length > 1200
  )
    issues.push({ field: "description", message: "Description is too long." });
  if (!product.categoryId)
    issues.push({ field: "categoryId", message: "Category is required." });
  if (!product.collectionId)
    issues.push({ field: "collectionId", message: "Collection is required." });
  if (
    product.images.length === 0 ||
    product.images.filter((image) => image.primary).length !== 1
  )
    issues.push({
      field: "images",
      message: "Exactly one primary image placeholder is required.",
    });
  return issues;
}

export function filterProducts(
  products: readonly CMSManagedProduct[],
  filters: ProductFilters,
) {
  const keyword = filters.keyword.trim().toLocaleLowerCase("en");
  return products
    .filter(
      (product) =>
        (!keyword ||
          [product.name, product.slug, ...product.tags]
            .join(" ")
            .toLocaleLowerCase("en")
            .includes(keyword)) &&
        (!filters.categoryId || product.categoryId === filters.categoryId) &&
        (!filters.collectionId ||
          product.collectionId === filters.collectionId) &&
        (filters.status === "ALL" || product.status === filters.status) &&
        (filters.flag === "ALL" ||
          (filters.flag === "FEATURED" && product.featured) ||
          (filters.flag === "TRENDING" && product.trending) ||
          (filters.flag === "NEW_ARRIVAL" && product.newArrival)),
    )
    .toSorted(
      (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
    );
}

export function duplicateProduct(
  product: CMSManagedProduct,
  products: readonly CMSManagedProduct[],
) {
  const base = normalizeSlug(`${product.slug}-copy`) || "product-copy";
  let slug = base;
  let suffix = 2;
  while (products.some((item) => item.slug === slug))
    slug = `${base}-${suffix++}`;
  return {
    ...structuredClone(product),
    id: `cms-product-${slug}`,
    name: `${product.name} Copy`.slice(0, 120),
    slug,
    status: "DRAFT" as const,
    featured: false,
    trending: false,
    newArrival: false,
    bestSeller: false,
    images: product.images.map((image) => ({
      ...image,
      id: `${image.id}-${slug}`,
    })),
  };
}

export function parseProductCMSContent(
  value: unknown,
): ProductCMSContent | null {
  if (!isRecord(value) || value.version !== PRODUCT_CMS_SCHEMA_VERSION)
    return null;
  if (
    !Array.isArray(value.products) ||
    !Array.isArray(value.categories) ||
    !Array.isArray(value.collections)
  )
    return null;
  if (
    value.products.length > 200 ||
    value.categories.length > 50 ||
    value.collections.length > 50
  )
    return null;
  const categories = value.categories.map(parseCategory);
  const collections = value.collections.map(parseCollection);
  const products = value.products.map(parseProduct);
  if (
    categories.some((item) => !item) ||
    collections.some((item) => !item) ||
    products.some((item) => !item)
  )
    return null;
  const result: ProductCMSContent = {
    version: PRODUCT_CMS_SCHEMA_VERSION,
    categories: categories as CMSManagedCategory[],
    collections: collections as CMSManagedCollection[],
    products: products as CMSManagedProduct[],
  };
  const categoryIds = new Set(result.categories.map((item) => item.id));
  const collectionIds = new Set(result.collections.map((item) => item.id));
  if (
    new Set(result.products.map((item) => item.slug)).size !==
    result.products.length
  )
    return null;
  if (
    result.products.some(
      (item) =>
        !categoryIds.has(item.categoryId) ||
        !collectionIds.has(item.collectionId) ||
        validateProduct(item, result.products).length,
    )
  )
    return null;
  return result;
}

function parseCategory(value: unknown): CMSManagedCategory | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 100),
    name = text(value.name, 80),
    slug = text(value.slug, 80),
    description = text(value.description, 400);
  const visible = boolean(value.visible),
    homepageVisible = boolean(value.homepageVisible),
    displayOrder = integer(value.displayOrder);
  if (
    !id ||
    !name ||
    !slug ||
    description === null ||
    visible === null ||
    homepageVisible === null ||
    displayOrder === null
  )
    return null;
  return {
    id,
    name,
    slug: normalizeSlug(slug),
    description,
    visible,
    homepageVisible,
    displayOrder,
  };
}

function parseCollection(value: unknown): CMSManagedCollection | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 100),
    name = text(value.name, 80),
    slug = text(value.slug, 80),
    description = text(value.description, 400);
  const visible = boolean(value.visible),
    featured = boolean(value.featured),
    displayOrder = integer(value.displayOrder);
  if (
    !id ||
    !name ||
    !slug ||
    description === null ||
    visible === null ||
    featured === null ||
    displayOrder === null ||
    !COLLECTION_KINDS.includes(value.kind as never)
  )
    return null;
  return {
    id,
    name,
    slug: normalizeSlug(slug),
    description,
    kind: value.kind as CMSManagedCollection["kind"],
    featured,
    visible,
    displayOrder,
  };
}

function parseProduct(value: unknown): CMSManagedProduct | null {
  if (
    !isRecord(value) ||
    !STATUSES.includes(value.status as ProductStatus) ||
    !Array.isArray(value.images)
  )
    return null;
  const fields = [
    "id",
    "sourceProductId",
    "name",
    "slug",
    "shortDescription",
    "longDescription",
    "categoryId",
    "collectionId",
    "seoTitle",
    "seoDescription",
  ] as const;
  const values = Object.fromEntries(
    fields.map((field) => [
      field,
      text(
        value[field],
        field === "longDescription"
          ? 1200
          : field.includes("Description")
            ? 320
            : 160,
      ),
    ]),
  );
  if (Object.values(values).some((item) => item === null)) return null;
  const priceMinor = integer(value.priceMinor),
    mrpMinor = integer(value.mrpMinor),
    displayOrder = integer(value.displayOrder);
  const tags = stringList(value.tags, 20, 40),
    seoKeywords = stringList(value.seoKeywords, 20, 60);
  const flags = [
    "featured",
    "trending",
    "newArrival",
    "bestSeller",
    "wholesaleAvailable",
  ] as const;
  if (
    priceMinor === null ||
    mrpMinor === null ||
    displayOrder === null ||
    !tags ||
    !seoKeywords ||
    flags.some((flag) => boolean(value[flag]) === null)
  )
    return null;
  const images = value.images.map((image) => parseImage(image));
  if (images.some((image) => !image)) return null;
  return {
    ...(values as unknown as Pick<CMSManagedProduct, (typeof fields)[number]>),
    slug: normalizeSlug(values.slug!),
    priceMinor,
    mrpMinor,
    displayOrder,
    tags,
    seoKeywords,
    status: value.status as ProductStatus,
    images: images as CMSManagedProduct["images"],
    featured: value.featured as boolean,
    trending: value.trending as boolean,
    newArrival: value.newArrival as boolean,
    bestSeller: value.bestSeller as boolean,
    wholesaleAvailable: value.wholesaleAvailable as boolean,
  };
}

function parseImage(
  value: unknown,
): CMSManagedProduct["images"][number] | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 120),
    placeholder = text(value.placeholder, 100),
    alt = text(value.alt, 180),
    caption = text(value.caption, 180);
  const primary = boolean(value.primary),
    order = integer(value.order, 1);
  return id &&
    placeholder &&
    alt &&
    caption !== null &&
    primary !== null &&
    order !== null
    ? { id, placeholder, alt, caption, primary, order }
    : null;
}

export const productCMSContentEqual = (
  a: ProductCMSContent,
  b: ProductCMSContent,
) => JSON.stringify(a) === JSON.stringify(b);
export const resetProduct = (content: ProductCMSContent, id: string) => ({
  ...content,
  products: content.products.map((item) =>
    item.id === id
      ? structuredClone(
          defaultProductCMSContent.products.find(
            (value) => value.sourceProductId === item.sourceProductId,
          ) ?? item,
        )
      : item,
  ),
});
export const resetCategories = (content: ProductCMSContent) => ({
  ...content,
  categories: cloneProductCMSContent().categories,
});
export const resetCategory = (content: ProductCMSContent, id: string) => ({
  ...content,
  categories: content.categories.map((item) =>
    item.id === id
      ? structuredClone(
          defaultProductCMSContent.categories.find(
            (value) => value.id === id,
          ) ?? item,
        )
      : item,
  ),
});
export const resetCollections = (content: ProductCMSContent) => ({
  ...content,
  collections: cloneProductCMSContent().collections,
});
export const resetCollection = (content: ProductCMSContent, id: string) => ({
  ...content,
  collections: content.collections.map((item) =>
    item.id === id
      ? structuredClone(
          defaultProductCMSContent.collections.find(
            (value) => value.id === id,
          ) ?? item,
        )
      : item,
  ),
});
