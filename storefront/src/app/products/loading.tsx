import { Container, Section, Stack } from "@/components/layout";
import styles from "@/features/catalogue-simulation/Catalogue.module.css";

export default function ProductsLoading() {
  return (
    <Section>
      <Container>
        <Stack gap="lg">
          <h1>Loading development catalogue</h1>
          <div aria-busy="true" aria-live="polite" className={styles.grid}>
            {Array.from({ length: 6 }, (_, index) => (
              <div
                aria-label={`Loading product ${index + 1}`}
                className={styles.skeleton}
                key={index}
                role="status"
              />
            ))}
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
