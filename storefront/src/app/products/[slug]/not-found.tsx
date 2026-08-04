import Link from "next/link";
import { Container, Section, Stack } from "@/components/layout";

export default function ProductNotFound() {
  return (
    <Section>
      <Container>
        <Stack gap="lg">
          <h1>Development product not found</h1>
          <p>The requested simulated product does not exist.</p>
          <Link href="/products">Return to the development catalogue</Link>
        </Stack>
      </Container>
    </Section>
  );
}
