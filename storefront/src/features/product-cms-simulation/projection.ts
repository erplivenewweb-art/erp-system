import { developmentProducts } from "@/features/catalogue-simulation/fixtures";
import type { CatalogueProduct } from "@/features/catalogue-simulation/types";
import type { CMSManagedCategory, CMSManagedProduct } from "./types";

export function projectCMSProduct(
  product: CMSManagedProduct,
  categories: readonly CMSManagedCategory[],
): CatalogueProduct {
  const source =
    developmentProducts.find((item) => item.id === product.sourceProductId) ??
    developmentProducts[0];
  const category = categories.find((item) => item.id === product.categoryId);
  const badges: CatalogueProduct["badges"] = product.featured
    ? ["FEATURED"]
    : product.newArrival
      ? ["NEW"]
      : [];
  return {
    ...source,
    id: product.id,
    slug: product.slug,
    title: product.name,
    subtitle: product.shortDescription,
    description: product.longDescription,
    category: {
      id: category?.id ?? source.category.id,
      slug: category?.slug ?? source.category.slug,
      title: category?.name ?? source.category.title,
      description: category?.description ?? source.category.description,
    },
    price: {
      currency: "INR",
      amount: Math.round(product.priceMinor / 100),
      label: `Simulated retail ₹${(product.priceMinor / 100).toLocaleString("en-IN")}`,
      simulated: true,
    },
    badges,
    media: product.images
      .toSorted((a, b) => a.order - b.order)
      .map((image) => ({
        id: image.id,
        alt: image.alt,
        label: image.caption || image.placeholder,
        aspectRatio: "portrait" as const,
      })),
    b2bVisible: product.wholesaleAvailable,
    seo: {
      title: product.seoTitle,
      description: product.seoDescription,
      canonicalPath: `/products/${product.slug}`,
    },
  };
}

export function homepageProductGroups(
  products: readonly CMSManagedProduct[],
  categories: readonly CMSManagedCategory[],
) {
  const published = products
    .filter((item) => item.status === "PUBLISHED")
    .toSorted((a, b) => a.displayOrder - b.displayOrder);
  const project = (items: CMSManagedProduct[]) =>
    items.slice(0, 3).map((item) => projectCMSProduct(item, categories));
  return {
    featured: project(published.filter((item) => item.featured)),
    trending: project(published.filter((item) => item.trending)),
    newArrivals: project(published.filter((item) => item.newArrival)),
    bestSellers: project(published.filter((item) => item.bestSeller)),
  };
}
