import type { Metadata } from "next";
import { CheckoutPage } from "@/features/checkout";
export const metadata: Metadata = { title: "Checkout preview", description: "Static shipping, billing, payment and order-review interface.", alternates: { canonical: "/checkout" }, robots: { index: false, follow: false } };
export default function Page() { return <CheckoutPage />; }
