import styles from "./state.module.css";

export default function Loading() {
  return (
    <section className={styles.state} aria-busy="true" aria-live="polite">
      <p className={styles.eyebrow}>Loading</p>
      <h1>Preparing your Silver Sankha experience</h1>
      <p>Please wait while this page is prepared.</p>
    </section>
  );
}
