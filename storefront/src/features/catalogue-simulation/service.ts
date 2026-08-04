import type { CatalogueProvider, CatalogueQuery } from "./types";
import {
  validateCategories,
  validatePage,
  validateProduct,
} from "./validation";

export function createCatalogueService(provider: CatalogueProvider) {
  return {
    async listProducts(query: CatalogueQuery) {
      return validatePage(await provider.listProducts(query));
    },
    async getProductBySlug(slug: string) {
      const value = await provider.getProductBySlug(slug);
      return value === undefined ? undefined : validateProduct(value);
    },
    async listCategories() {
      return validateCategories(await provider.listCategories());
    },
    async searchProducts(keyword: string, limit = 24) {
      return validatePage(await provider.searchProducts(keyword, limit));
    },
  };
}

export type CatalogueService = ReturnType<typeof createCatalogueService>;
