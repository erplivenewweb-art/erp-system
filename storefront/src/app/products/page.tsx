import type { Metadata } from "next";
import { Container, Section, Stack } from "@/components/layout";
import {
  CatalogueErrorState,
  CatalogueUnavailableError,
  CatalogueValidationError,
  DevelopmentCatalogueIndicator,
  ProductListing,
  catalogueQuery,
  createCatalogueService,
  createDevelopmentCatalogueProvider,
  type CatalogueSimulationMode,
} from "@/features/catalogue-simulation";

export const metadata: Metadata = {
  title: "Development Jewellery Catalogue",
  description:
    "Explore deterministic fictional Silver Sankha, Pola and related jewellery development fixtures.",
  alternates: { canonical: "/products" },
  robots: { index: false, follow: false },
  openGraph: {
    title: "Development Jewellery Catalogue",
    description:
      "Explore deterministic fictional Silver Sankha, Pola and related jewellery development fixtures.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Development Jewellery Catalogue",
    description:
      "Explore deterministic fictional Silver Sankha, Pola and related jewellery development fixtures.",
  },
};

export function developmentSimulationMode(
  value: string | string[] | undefined,
  environment: string | undefined = process.env.NODE_ENV,
): CatalogueSimulationMode {
  if (environment !== "development" || typeof value !== "string")
    return "success";
  return ["empty", "unavailable", "invalid"].includes(value)
    ? (value as CatalogueSimulationMode)
    : "success";
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parameters = (await searchParams) ?? {};
  const query = catalogueQuery(parameters);
  const showDevelopmentIndicator = process.env.NODE_ENV === "development";
  const service = createCatalogueService(
    createDevelopmentCatalogueProvider(
      developmentSimulationMode(parameters.simulate),
    ),
  );
  const result = await Promise.all([
    service.listProducts(query),
    service.listCategories(),
  ])
    .then(([catalogue, categories]) => ({
      ok: true as const,
      catalogue,
      categories,
    }))
    .catch((error: unknown) => ({
      ok: false as const,
      code:
        error instanceof CatalogueUnavailableError ||
        error instanceof CatalogueValidationError
          ? error.code
          : "CATALOGUE_UNKNOWN_ERROR",
    }));
  if (result.ok) {
    return (
      <ProductListing
        catalogue={result.catalogue}
        categories={result.categories}
        query={query}
        showDevelopmentIndicator={showDevelopmentIndicator}
      />
    );
  }
  return (
    <Section>
      <Container>
        <Stack gap="lg">
          <h1>Development jewellery catalogue</h1>
          <DevelopmentCatalogueIndicator visible={showDevelopmentIndicator} />
          <CatalogueErrorState code={result.code} />
        </Stack>
      </Container>
    </Section>
  );
}
