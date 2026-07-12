import type { Metadata } from "next";
import { HomePage } from "@/features/home";

const description = "Discover Silver Sankha and Silver Pola from a manufacturer-led jewellery house focused on clear facts, considered design and dignified service.";

export const metadata: Metadata = {
  title: "Silver Sankha Jewellery House",
  description,
  alternates: { canonical: "/" },
  openGraph: { title: "Silver Sankha Jewellery House", description, type: "website" },
  robots: { index: true, follow: true },
};

export default function Page() { return <HomePage />; }
