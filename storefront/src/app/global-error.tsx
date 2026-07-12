"use client";

import styles from "./state.module.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className={styles.state} id="main-content" role="alert">
          <p className={styles.eyebrow}>Storefront unavailable</p>
          <h1>A temporary error occurred</h1>
          <p>Try again. If the problem continues, use the documented support path.</p>
          <button className={styles.action} onClick={reset} type="button">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

