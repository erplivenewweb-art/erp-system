import styles from "@/features/customer-intent/CustomerIntent.module.css";

export default function Loading() {
  return (
    <div
      aria-label="Loading development wishlist"
      className={styles.intentSkeleton}
      role="status"
    >
      <span />
      <span />
      <span />
    </div>
  );
}
