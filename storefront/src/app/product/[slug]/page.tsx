import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, products } from "@/features/catalog";
import { ProductDetail } from "@/features/product";

export function generateStaticParams() { return products.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const product = getProduct(slug); if (!product) return {}; return { title: product.name, description: product.description, alternates: { canonical: `/product/${slug}` }, openGraph: { title: product.name, description: product.description, type: "website" } }; }
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const product = getProduct(slug); if (!product) notFound(); return <ProductDetail product={product} />; }
