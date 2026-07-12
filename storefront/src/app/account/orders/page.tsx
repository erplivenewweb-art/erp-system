import type { Metadata } from "next";
import { OrdersPage } from "@/features/orders";
export const metadata: Metadata = { title: "Account orders preview", description: "Static account order-history presentation.", alternates: { canonical: "/account/orders" }, robots: { index: false, follow: false } };
export default function Page() { return <OrdersPage />; }
