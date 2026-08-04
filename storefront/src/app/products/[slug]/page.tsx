import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  SimulationProductDetail,
  createCatalogueService,
  createDevelopmentCatalogueProvider,
  developmentProducts,
} from "@/features/catalogue-simulation";

const service = () =>
  createCatalogueService(createDevelopmentCatalogueProvider());

export function generateStaticParams() {
  return developmentProducts.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await service().getProductBySlug(slug);
  if (!product)
    return {
      title: "Product not found",
      robots: { index: false, follow: false },
    };
  return {
    title: product.seo.title,
    description: product.seo.description,
    alternates: { canonical: product.seo.canonicalPath },
    robots: { index: false, follow: false },
    openGraph: {
      title: product.seo.title,
      description: product.seo.description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: product.seo.title,
      description: product.seo.description,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const catalogue = service();
  const product = await catalogue.getProductBySlug(slug);
  if (!product) notFound();
  const relatedPage = await catalogue.listProducts({
    category: product.category.slug,
    limit: 4,
  });
  const related = relatedPage.items
    .filter((item) => item.slug !== product.slug)
    .slice(0, 3);
  const similar = (
    await catalogue.listProducts({ purity: product.purity, limit: 6 })
  ).items
    .filter(
      (item) =>
        item.slug !== product.slug &&
        !related.some((relatedProduct) => relatedProduct.slug === item.slug),
    )
    .slice(0, 3);
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    sku: product.slug,
    category: product.category.title,
    material: product.purity.replace("_", " "),
    offers: {
      "@type": "Offer",
      priceCurrency: product.price.currency,
      price: product.price.amount,
      availability: `https://schema.org/${
        product.availability === "OUT_OF_STOCK" ? "OutOfStock" : "InStock"
      }`,
    },
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Products", item: "/products" },
      { "@type": "ListItem", position: 3, name: product.title },
    ],
  };
  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify(productSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>
      <SimulationProductDetail
        product={product}
        related={related}
        similar={similar}
        showDevelopmentIndicator={process.env.NODE_ENV === "development"}
      />
    </>
  );
}
