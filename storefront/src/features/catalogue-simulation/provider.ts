import { developmentCategories, developmentProducts } from "./fixtures";
import type {
  CataloguePage,
  CatalogueProduct,
  CatalogueProvider,
  CatalogueQuery,
  CatalogueSimulationMode,
} from "./types";
import { CatalogueUnavailableError, normalizeKeyword } from "./validation";

const matches = (product: CatalogueProduct, query: CatalogueQuery): boolean => {
  const keyword = normalizeKeyword(query.keyword)?.toLocaleLowerCase("en");
  const searchable = [
    product.title,
    product.subtitle,
    product.description,
    product.category.title,
    product.purity,
  ]
    .join(" ")
    .toLocaleLowerCase("en");
  return (
    (!keyword || searchable.includes(keyword)) &&
    (!query.category || product.category.slug === query.category) &&
    (!query.purity || product.purity === query.purity) &&
    (!query.availability || product.availability === query.availability) &&
    (!query.audience ||
      (query.audience === "B2C" ? product.b2cVisible : product.b2bVisible))
  );
};

const page = (
  items: readonly CatalogueProduct[],
  limit: number,
): CataloguePage => ({
  items: items.slice(0, limit),
  page: {
    limit,
    total: items.length,
    nextCursor: items.length > limit ? `offset:${limit}` : null,
  },
});

export function createDevelopmentCatalogueProvider(
  mode: CatalogueSimulationMode = "success",
): CatalogueProvider {
  const unavailable = () => {
    if (mode === "unavailable")
      throw new CatalogueUnavailableError(
        "Development catalogue provider unavailable",
      );
  };
  return {
    async listProducts(query) {
      unavailable();
      if (mode === "invalid") return { items: "invalid", page: null };
      if (mode === "empty") return page([], query.limit);
      return page(
        developmentProducts.filter((product) => matches(product, query)),
        query.limit,
      );
    },
    async getProductBySlug(slug) {
      unavailable();
      if (mode === "invalid") return { slug, title: null };
      return developmentProducts.find((product) => product.slug === slug);
    },
    async listCategories() {
      unavailable();
      if (mode === "invalid") return "invalid";
      return developmentCategories;
    },
    async searchProducts(keyword, limit) {
      unavailable();
      if (mode === "invalid") return { items: null };
      return page(
        developmentProducts.filter((product) =>
          matches(product, { keyword, limit }),
        ),
        limit,
      );
    },
  };
}
