import type { Metadata } from "next";
import { DealerLanding } from "@/features/dealer";
export const metadata: Metadata = { title: "Wholesale partnerships", description: "Explore a manufacturer-led Silver Sankha wholesale partnership preview.", alternates: { canonical: "/wholesale" }, robots: { index: true, follow: true }, openGraph: { title: "Silver Sankha Wholesale Partnerships", description: "A public introduction to the future dealer programme.", type: "website" } };
export default function Page(){return <DealerLanding/>;}
