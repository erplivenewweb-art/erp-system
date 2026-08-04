import type { Metadata } from "next";
import { SimulationProfilePage } from "@/features/customer-account-simulation";

export const metadata: Metadata = {
  title: "Simulated customer profile",
  description: "A browser-only, unverified customer profile simulation.",
  alternates: { canonical: "/account/profile" },
  robots: { index: false, follow: false, nocache: true },
};

export default function Page() {
  return <SimulationProfilePage />;
}
