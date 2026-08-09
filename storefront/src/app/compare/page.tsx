import type { Metadata } from "next";
import { Container, Section, Stack } from "@/components/layout";
import { Breadcrumb } from "@/components/navigation";
import { developmentProducts } from "@/features/catalogue-simulation";
import { ComparisonBoundary } from "@/features/discovery-simulation";

export const metadata: Metadata = {
  title: "Compare simulated products",
  description: "Browser-local development product comparison.",
  robots: { index: false, follow: false, nocache: true },
};

export default function ComparePage() {
  return (
    <Section>
      <Container>
        <Stack gap="lg">
          <Breadcrumb
            items={[
              { href: "/", label: "Home" },
              { href: "/products", label: "Products" },
              { label: "Compare" },
            ]}
          />
          <div>
            <p>Development discovery</p>
            <h1>Compare simulated products</h1>
            <p>
              Compare up to four fictional products. No inventory, pricing
              service, account, or analytics system is connected.
            </p>
          </div>
          <ComparisonBoundary
            enabled={process.env.NODE_ENV === "development"}
            products={developmentProducts}
          />
        </Stack>
      </Container>
    </Section>
  );
}
