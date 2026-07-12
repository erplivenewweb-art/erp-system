import styles from "./state.module.css";

export default function Loading() {
  return (
    <section className={styles.state} aria-busy="true" aria-live="polite">
      <p className={styles.eyebrow}>Loading</p>
      <h1>Preparing the storefront scaffold</h1>
      <p>Please wait. No commerce operation is being performed.</p>
    </section>
  );
}

