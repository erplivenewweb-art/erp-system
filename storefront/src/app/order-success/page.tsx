import type { Metadata } from "next";
import { OrderSuccessPage } from "@/features/checkout";
export const metadata: Metadata = { title: "Order confirmation preview", description: "Static confirmation screen; no real order exists.", robots: { index: false, follow: false } };
export default function Page() { return <OrderSuccessPage />; }
