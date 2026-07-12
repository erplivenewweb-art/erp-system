import type { Metadata } from "next";
import { AddressesPage } from "@/features/address";
export const metadata: Metadata = { title: "Address book preview", description: "Static customer address-management UI.", alternates: { canonical: "/account/addresses" }, robots: { index: false, follow: false } };
export default function Page() { return <AddressesPage />; }
