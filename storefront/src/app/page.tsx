import type { Metadata } from "next";
import { HomePage } from "@/features/home";

const description =
  "Discover Silver Sankha and Silver Pola from a manufacturer-led jewellery house focused on clear facts, considered design and dignified service.";

export const metadata: Metadata = {
  title: "Silver Sankha Jewellery House",
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Silver Sankha Jewellery House",
    description,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Silver Sankha Jewellery House",
    description,
  },
  robots: { index: true, follow: true },
};

export default function Page() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Silver Sankha Jewellery House",
    description,
    potentialAction: {
      "@type": "SearchAction",
      target: "/products?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
      <HomePage />
    </>
  );
}
