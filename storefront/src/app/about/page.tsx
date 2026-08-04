import type { Metadata } from "next";
import Link from "next/link";
import { Container, Section, Stack } from "@/components/layout";
import { Breadcrumb } from "@/components/navigation";

const description =
  "A development-safe introduction to the manufacturer-led Silver Sankha jewellery house.";

export const metadata: Metadata = {
  title: "About Silver Sankha",
  description,
  alternates: { canonical: "/about" },
  openGraph: { title: "About Silver Sankha", description, type: "website" },
  twitter: {
    card: "summary_large_image",
    title: "About Silver Sankha",
    description,
  },
};

export default function AboutPage() {
  return (
    <Section>
      <Container>
        <Stack gap="lg">
          <Breadcrumb
            items={[{ href: "/", label: "Home" }, { label: "About" }]}
          />
          <p>Our story</p>
          <h1>Jewellery shaped by material clarity and considered craft.</h1>
          <p>
            Silver Sankha is presented as a manufacturer-led jewellery house.
            This development experience describes design intent without
            revealing production systems, supplier information, or manufacturing
            secrets.
          </p>
          <Link href="/products">Explore the simulated catalogue</Link>
        </Stack>
      </Container>
    </Section>
  );
}
