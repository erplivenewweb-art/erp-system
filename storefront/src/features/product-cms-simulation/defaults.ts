import {
  developmentCategories,
  developmentProducts,
} from "@/features/catalogue-simulation";
import {
  PRODUCT_CMS_SCHEMA_VERSION,
  type CMSManagedCollection,
  type CMSManagedProduct,
  type ProductCMSContent,
} from "./types";

export const defaultCollections: CMSManagedCollection[] = [
  collection(
    "collection-featured",
    "Featured Collection",
    "featured",
    "FEATURED",
    true,
    1,
  ),
  collection(
    "collection-wedding",
    "Wedding Collection",
    "wedding",
    "WEDDING",
    true,
    2,
  ),
  collection(
    "collection-traditional",
    "Traditional",
    "traditional",
    "TRADITIONAL",
    true,
    3,
  ),
  collection(
    "collection-festival",
    "Festival",
    "festival",
    "FESTIVAL",
    false,
    4,
  ),
  collection(
    "collection-new",
    "New Collection",
    "new-collection",
    "NEW",
    true,
    5,
  ),
  collection(
    "collection-seasonal",
    "Seasonal",
    "seasonal",
    "SEASONAL",
    false,
    6,
  ),
];

function collection(
  id: string,
  name: string,
  slug: string,
  kind: CMSManagedCollection["kind"],
  visible: boolean,
  displayOrder: number,
): CMSManagedCollection {
  return {
    id,
    name,
    slug,
    kind,
    description: `${name} is fictional development merchandising content.`,
    featured: kind === "FEATURED",
    visible,
    displayOrder,
  };
}

const products: CMSManagedProduct[] = developmentProducts.map(
  (product, index) => ({
    id: `cms-${product.id}`,
    sourceProductId: product.id,
    name: product.title,
    slug: product.slug,
    shortDescription: product.subtitle,
    longDescription: product.description,
    categoryId: product.category.id,
    collectionId:
      index % 2 === 0 ? "collection-featured" : "collection-traditional",
    priceMinor: product.price.amount * 100,
    mrpMinor: product.price.amount * 110,
    tags: [product.category.slug, product.purity.toLowerCase()],
    featured: product.badges.includes("FEATURED"),
    trending: product.badges.includes("FEATURED"),
    newArrival: product.badges.includes("NEW"),
    bestSeller: index > 0 && index < 4,
    wholesaleAvailable: product.b2bVisible,
    displayOrder: index + 1,
    status: "PUBLISHED",
    seoTitle: product.seo.title,
    seoDescription: product.seo.description,
    seoKeywords: [product.category.title, product.purity.replaceAll("_", " ")],
    images: product.media.map((image, imageIndex) => ({
      id: image.id,
      placeholder: image.label,
      alt: image.alt,
      caption: `${image.label} — development placeholder`,
      primary: imageIndex === 0,
      order: imageIndex + 1,
    })),
  }),
);

export const defaultProductCMSContent: ProductCMSContent = {
  version: PRODUCT_CMS_SCHEMA_VERSION,
  products,
  categories: developmentCategories.map((category, index) => ({
    id: category.id,
    name: category.title,
    slug: category.slug,
    description: category.description,
    visible: true,
    homepageVisible: index < 3,
    displayOrder: index + 1,
  })),
  collections: defaultCollections,
};

export function cloneProductCMSContent(
  content: ProductCMSContent = defaultProductCMSContent,
) {
  return structuredClone(content);
}
