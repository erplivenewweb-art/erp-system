import type { HomeMedia } from "./types";
import styles from "./HomePage.module.css";

export function MediaPlaceholder({ media }: { media: HomeMedia }) {
  return <div aria-label={media.alt} className={`${styles.media} ${styles[media.ratio]}`} role="img"><span>{media.eyebrow}</span><strong aria-hidden="true">SS</strong></div>;
}

