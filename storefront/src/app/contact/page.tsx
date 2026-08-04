import type { Metadata } from "next";
import Link from "next/link";
import { Container, Section, Stack } from "@/components/layout";
import { Breadcrumb } from "@/components/navigation";

const description =
  "Development-safe contact paths for retail questions and wholesale enquiries.";

export const metadata: Metadata = {
  title: "Contact Silver Sankha",
  description,
  alternates: { canonical: "/contact" },
  openGraph: { title: "Contact Silver Sankha", description, type: "website" },
  twitter: {
    card: "summary_large_image",
    title: "Contact Silver Sankha",
    description,
  },
};

export default function ContactPage() {
  return (
    <Section>
      <Container>
        <Stack gap="lg">
          <Breadcrumb
            items={[{ href: "/", label: "Home" }, { label: "Contact" }]}
          />
          <p>Contact</p>
          <h1>Begin with the right conversation.</h1>
          <p>
            Retail contact delivery is not connected in development. Wholesale
            visitors can continue to the existing enquiry introduction.
          </p>
          <div>
            <Link href="/products">Browse products</Link>
            {" · "}
            <Link href="/wholesale">Wholesale enquiries</Link>
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
