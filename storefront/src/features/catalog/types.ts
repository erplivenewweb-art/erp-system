export interface CatalogueLink { href: string; label: string; }
export interface CatalogueMedia { alt: string; label: string; ratio?: "portrait" | "landscape" | "square"; }
export interface ProductFacts { material: string; manufacturing: string; purity: string; size: string; weight: string; }
export interface ProductFixture {
  availability: string;
  category: string;
  collection: string;
  description: string;
  featured?: boolean;
  facts: ProductFacts;
  gallery: readonly CatalogueMedia[];
  name: string;
  priceLabel: string;
  slug: string;
}
export interface CollectionFixture { description: string; eyebrow: string; featured?: boolean; media: CatalogueMedia; name: string; slug: string; story: string; }
export interface CategoryFixture { description: string; name: string; slug: string; }

