import styles from "@/features/customer-intent/CustomerIntent.module.css";

export default function Loading() {
  return (
    <div
      aria-label="Loading simulated cart"
      className={styles.intentSkeleton}
      role="status"
    >
      <span />
      <span />
      <span />
    </div>
  );
}
