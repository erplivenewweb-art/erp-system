"use client";

import { Container, Section, Stack } from "@/components/layout";
import { CatalogueErrorState } from "@/features/catalogue-simulation";

export default function ProductsError() {
  return (
    <Section>
      <Container>
        <Stack gap="lg">
          <h1>Development jewellery catalogue</h1>
          <CatalogueErrorState code="CATALOGUE_ROUTE_ERROR" />
        </Stack>
      </Container>
    </Section>
  );
}
