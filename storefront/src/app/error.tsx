"use client";

import { useEffect } from "react";
import styles from "./state.module.css";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Storefront route error", { digest: error.digest });
  }, [error]);

  return (
    <section className={styles.state} role="alert">
      <p className={styles.eyebrow}>Unable to continue</p>
      <h1>We could not prepare this page</h1>
      <p>Please try again. No order or account action was completed.</p>
      <button className={styles.action} onClick={reset} type="button">
        Try again
      </button>
    </section>
  );
}
