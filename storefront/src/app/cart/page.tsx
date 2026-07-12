import type { Metadata } from "next";
import { CartPage } from "@/features/cart";
export const metadata: Metadata = { title: "Shopping cart preview", description: "Static shopping cart presentation with no stored commerce data.", alternates: { canonical: "/cart" }, robots: { index: false, follow: true } };
export default function Page() { return <CartPage />; }
