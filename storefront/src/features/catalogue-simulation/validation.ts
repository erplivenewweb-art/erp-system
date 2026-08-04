import type {
  CatalogueAvailability,
  CatalogueCategory,
  CataloguePage,
  CatalogueProduct,
  CataloguePurity,
  CatalogueQuery,
} from "./types";

const purities = new Set<CataloguePurity>([
  "925_SILVER",
  "999_SILVER",
  "GOLD_PLATED",
]);
const availability = new Set<CatalogueAvailability>([
  "IN_STOCK",
  "LOW_STOCK",
  "MADE_TO_ORDER",
  "OUT_OF_STOCK",
]);

const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

export function normalizeKeyword(
  value: string | undefined,
): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim().slice(0, 80);
  return normalized || undefined;
}

export function catalogueQuery(
  input: Record<string, string | string[] | undefined>,
): CatalogueQuery {
  const single = (name: string) => {
    const value = input[name];
    return typeof value === "string" ? value : undefined;
  };
  const purity = single("purity");
  const stock = single("availability");
  const audience = single("audience");
  return {
    limit: 24,
    ...(normalizeKeyword(single("q"))
      ? { keyword: normalizeKeyword(single("q")) }
      : {}),
    ...(single("category") ? { category: single("category") } : {}),
    ...(purity && purities.has(purity as CataloguePurity)
      ? { purity: purity as CataloguePurity }
      : {}),
    ...(stock && availability.has(stock as CatalogueAvailability)
      ? { availability: stock as CatalogueAvailability }
      : {}),
    ...(audience === "B2C" || audience === "B2B" ? { audience } : {}),
  };
}

export function validateProduct(value: unknown): CatalogueProduct {
  const product = record(value);
  if (
    !product ||
    typeof product.id !== "string" ||
    typeof product.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug) ||
    typeof product.title !== "string" ||
    typeof product.subtitle !== "string" ||
    typeof product.description !== "string" ||
    !record(product.category) ||
    !purities.has(product.purity as CataloguePurity) ||
    !Array.isArray(product.variants) ||
    product.variants.length === 0 ||
    !Array.isArray(product.media) ||
    product.media.length === 0 ||
    !record(product.price) ||
    !availability.has(product.availability as CatalogueAvailability) ||
    !Array.isArray(product.badges) ||
    !Array.isArray(product.highlights) ||
    !Array.isArray(product.care) ||
    typeof product.b2cVisible !== "boolean" ||
    typeof product.b2bVisible !== "boolean" ||
    !record(product.seo)
  ) {
    throw new CatalogueValidationError("Catalogue product response is invalid");
  }
  return structuredClone(product) as unknown as CatalogueProduct;
}

export function validatePage(value: unknown): CataloguePage {
  const page = record(value);
  const pagination = record(page?.page);
  if (
    !page ||
    !Array.isArray(page.items) ||
    !pagination ||
    typeof pagination.limit !== "number" ||
    typeof pagination.total !== "number" ||
    (pagination.nextCursor !== null &&
      typeof pagination.nextCursor !== "string")
  ) {
    throw new CatalogueValidationError("Catalogue list response is invalid");
  }
  return {
    items: page.items.map(validateProduct),
    page: {
      limit: pagination.limit,
      total: pagination.total,
      nextCursor: pagination.nextCursor as string | null,
    },
  };
}

export function validateCategories(
  value: unknown,
): readonly CatalogueCategory[] {
  if (!Array.isArray(value))
    throw new CatalogueValidationError("Catalogue categories are invalid");
  return value.map((item) => {
    const category = record(item);
    if (
      !category ||
      typeof category.id !== "string" ||
      typeof category.slug !== "string" ||
      typeof category.title !== "string" ||
      typeof category.description !== "string"
    ) {
      throw new CatalogueValidationError("Catalogue category is invalid");
    }
    return structuredClone(category) as unknown as CatalogueCategory;
  });
}

export class CatalogueValidationError extends Error {
  readonly code = "CATALOGUE_RESPONSE_INVALID";
}

export class CatalogueUnavailableError extends Error {
  readonly code = "CATALOGUE_PROVIDER_UNAVAILABLE";
}
