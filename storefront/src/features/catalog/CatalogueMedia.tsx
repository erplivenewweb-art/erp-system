import type { CatalogueMedia as Media } from "./types";
import styles from "./Catalog.module.css";

export function CatalogueMedia({ media }: { media: Media }) {
  return <div aria-label={media.alt} className={`${styles.media} ${styles[media.ratio ?? "portrait"]}`} role="img"><span>{media.label}</span><strong aria-hidden="true">SS</strong></div>;
}
