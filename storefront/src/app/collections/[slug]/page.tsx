import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingPage, collections, getCollection, products } from "@/features/catalog";

export function generateStaticParams() { return collections.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const collection = getCollection(slug); if (!collection) return {}; return { title: collection.name, description: collection.description, alternates: { canonical: `/collections/${slug}` }, openGraph: { title: collection.name, description: collection.description, type: "website" } }; }
export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const collection = getCollection(slug); if (!collection) notFound(); return <ListingPage title={collection.name} description={`${collection.description} ${collection.story}`} products={products.filter((product) => product.collection === slug)} breadcrumb={[{ href: "/", label: "Home" }, { href: "/collections", label: "Collections" }, { label: collection.name }]} />; }
