import styles from "./Catalogue.module.css";

export function DevelopmentCatalogueIndicator({
  visible,
}: {
  visible: boolean;
}) {
  return visible ? (
    <p className={styles.simulation} role="status">
      Development catalogue — simulated data
    </p>
  ) : null;
}
