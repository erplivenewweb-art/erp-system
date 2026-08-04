import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  SimulationCategoryExperience,
  developmentCategories,
  developmentProducts,
} from "@/features/catalogue-simulation";

export function generateStaticParams() {
  return developmentCategories.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = developmentCategories.find((item) => item.slug === slug);
  if (!category)
    return { title: "Category not found", robots: { index: false } };
  const title = `${category.title} Jewellery`;
  return {
    title,
    description: category.description,
    alternates: { canonical: `/products/category/${category.slug}` },
    robots: { index: false, follow: false },
    openGraph: { title, description: category.description, type: "website" },
    twitter: {
      card: "summary_large_image",
      title,
      description: category.description,
    },
  };
}

export default async function ProductCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = developmentCategories.find((item) => item.slug === slug);
  if (!category) notFound();
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Products", item: "/products" },
      { "@type": "ListItem", position: 3, name: category.title },
    ],
  };
  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>
      <SimulationCategoryExperience
        category={category}
        products={developmentProducts.filter(
          (product) => product.category.slug === category.slug,
        )}
      />
    </>
  );
}
