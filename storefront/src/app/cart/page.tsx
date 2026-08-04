import type { Metadata } from "next";
import { SimulationCartPage } from "@/features/customer-intent";
export const metadata: Metadata = {
  title: "Simulated shopping cart",
  description: "A local development-only shopping cart simulation.",
  alternates: { canonical: "/cart" },
  robots: { index: false, follow: false, nocache: true },
};
export default function Page() {
  return <SimulationCartPage />;
}
