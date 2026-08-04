import type { Metadata } from "next";
import { SimulationAddressBookPage } from "@/features/customer-account-simulation";

export const metadata: Metadata = {
  title: "Simulated address book",
  description: "A browser-only delivery-address simulation.",
  alternates: { canonical: "/account/addresses" },
  robots: { index: false, follow: false, nocache: true },
};

export default function Page() {
  return <SimulationAddressBookPage />;
}
