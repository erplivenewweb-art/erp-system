import type { Metadata } from "next";
import { SimulatedSignInPage } from "@/features/customer-account-simulation";

export const metadata: Metadata = {
  title: "Simulated customer sign-in",
  description: "A local-browser session simulation without authentication.",
  alternates: { canonical: "/account/sign-in" },
  robots: { index: false, follow: false, nocache: true },
};

export default function Page() {
  return <SimulatedSignInPage />;
}
