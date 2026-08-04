export type CataloguePurity = "925_SILVER" | "999_SILVER" | "GOLD_PLATED";
export type CatalogueAvailability =
  "IN_STOCK" | "LOW_STOCK" | "MADE_TO_ORDER" | "OUT_OF_STOCK";
export type CatalogueAudience = "B2C" | "B2B";
export type ProductBadge = "FEATURED" | "NEW" | "MADE_TO_ORDER";

export interface CatalogueCategory {
  id: string;
  slug: string;
  title: string;
  description: string;
}

export interface ProductMedia {
  id: string;
  alt: string;
  label: string;
  aspectRatio: "portrait" | "square" | "landscape";
  source?: string;
}

export interface ProductVariant {
  id: string;
  size: string;
  weight: string;
  availability: CatalogueAvailability;
}

export interface PricePresentation {
  currency: "INR";
  amount: number;
  label: string;
  simulated: true;
}

export interface CatalogueSeo {
  title: string;
  description: string;
  canonicalPath: string;
}

export interface CatalogueProduct {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: CatalogueCategory;
  purity: CataloguePurity;
  variants: readonly ProductVariant[];
  media: readonly ProductMedia[];
  price: PricePresentation;
  availability: CatalogueAvailability;
  badges: readonly ProductBadge[];
  highlights: readonly string[];
  care: readonly string[];
  b2cVisible: boolean;
  b2bVisible: boolean;
  seo: CatalogueSeo;
}

export interface CatalogueQuery {
  keyword?: string;
  category?: string;
  purity?: CataloguePurity;
  availability?: CatalogueAvailability;
  audience?: CatalogueAudience;
  limit: number;
}

export interface CataloguePage {
  items: readonly CatalogueProduct[];
  page: {
    limit: number;
    total: number;
    nextCursor: string | null;
  };
}

export type CatalogueSimulationMode =
  "success" | "empty" | "unavailable" | "invalid";

export interface CatalogueProvider {
  listProducts(query: CatalogueQuery): Promise<unknown>;
  getProductBySlug(slug: string): Promise<unknown>;
  listCategories(): Promise<unknown>;
  searchProducts(keyword: string, limit: number): Promise<unknown>;
}
