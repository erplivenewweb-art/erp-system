import type { Metadata } from "next";
import { SimulationWishlistPage } from "@/features/customer-intent";
export const metadata: Metadata = {
  title: "Development wishlist",
  description: "A local development-only wishlist simulation.",
  alternates: { canonical: "/wishlist" },
  robots: { index: false, follow: false, nocache: true },
};
export default function Page() {
  return <SimulationWishlistPage />;
}
