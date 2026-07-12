import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingPage, categories, getCategory, products } from "@/features/catalog";

export function generateStaticParams() { return categories.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const category = getCategory(slug); if (!category) return {}; return { title: category.name, description: category.description, alternates: { canonical: `/category/${slug}` }, openGraph: { title: category.name, description: category.description, type: "website" } }; }
export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const category = getCategory(slug); if (!category) notFound(); return <ListingPage title={category.name} description={category.description} products={products.filter((product) => product.category === slug)} breadcrumb={[{ href: "/", label: "Home" }, { href: "/shop", label: "Shop" }, { label: category.name }]} />; }
