import type { Metadata } from "next";
import { SimulationAccountDashboard } from "@/features/customer-account-simulation";

export const metadata: Metadata = {
  title: "Simulated customer account",
  description: "A browser-only customer account simulation.",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: false, nocache: true },
};

export default function Page() {
  return <SimulationAccountDashboard />;
}
