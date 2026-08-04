import type { Metadata } from "next";
import { SimulationCheckoutPage } from "@/features/customer-account-simulation";

export const metadata: Metadata = {
  title: "Checkout readiness preview",
  description: "A local simulation that cannot create an order or payment.",
  alternates: { canonical: "/checkout" },
  robots: { index: false, follow: false, nocache: true },
};

export default function Page() {
  return <SimulationCheckoutPage />;
}
