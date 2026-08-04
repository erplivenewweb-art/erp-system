import type { ProductMedia } from "./types";
import styles from "./Catalogue.module.css";

export function CatalogueProductMedia({ media }: { media: ProductMedia }) {
  return (
    <div
      aria-label={media.alt}
      className={styles.media}
      data-missing-image={media.source ? "false" : "true"}
      data-ratio={media.aspectRatio}
      role="img"
    >
      <span>
        {media.source
          ? media.label
          : `${media.label} · development placeholder`}
      </span>
      <strong aria-hidden="true">SS</strong>
    </div>
  );
}
