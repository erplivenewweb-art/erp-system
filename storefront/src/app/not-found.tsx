import Link from "next/link";
import styles from "./state.module.css";

export default function NotFound() {
  return (
    <section className={styles.state}>
      <p className={styles.eyebrow}>404</p>
      <h1>Page not found</h1>
      <p>The page may have moved or may not be available in this storefront preview.</p>
      <Link className={styles.action} href="/">Return to homepage</Link>
    </section>
  );
}
