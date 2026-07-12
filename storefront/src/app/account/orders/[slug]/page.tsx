import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { syntheticOrders } from "@/features/account";
import { OrderDetailPage } from "@/features/orders";
export const metadata: Metadata = { title: "Order detail preview", description: "Static order-detail and timeline presentation.", robots: { index: false, follow: false } };
export function generateStaticParams() { return syntheticOrders.map(({ slug }) => ({ slug })); }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; if (!syntheticOrders.some((item) => item.slug === slug)) notFound(); return <OrderDetailPage />; }
