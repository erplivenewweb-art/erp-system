import Link from "next/link";
import styles from "./state.module.css";

export default function NotFound() {
  return (
    <section className={styles.state}>
      <p className={styles.eyebrow}>404</p>
      <h1>Page not found</h1>
      <p>This scaffold contains only its foundational route.</p>
      <Link className={styles.action} href="/">Return to scaffold</Link>
    </section>
  );
}

