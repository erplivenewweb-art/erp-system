"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Container, Section, Stack } from "@/components/layout";
import { Breadcrumb } from "@/components/navigation";
import { useCustomerAccount } from "./CustomerAccountProvider";
import { AccountSimulationNotice } from "./SimulationNotice";
import styles from "./CustomerAccount.module.css";

export function SimulatedSignInPage() {
  const account = useCustomerAccount();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = account.startSimulatedSession(email);
    if (!result.ok) {
      setError(result.error);
      queueMicrotask(() => errorRef.current?.focus());
    } else {
      setError("");
    }
  }

  return (
    <Section>
      <Container>
        <Stack gap="lg">
          <Breadcrumb
            items={[
              { href: "/", label: "Home" },
              { href: "/account", label: "Account" },
              { label: "Simulated sign in" },
            ]}
          />
          <div className={styles.pageHeader}>
            <p className={styles.eyebrow}>Local development session</p>
            <h1>Continue in account simulation</h1>
            <p>
              Use a fictional email address to preview the account journey on
              this browser.
            </p>
          </div>
          <AccountSimulationNotice
            persistenceStatus={account.persistenceStatus}
          />
          <form className={styles.form} noValidate onSubmit={submit}>
            {error ? (
              <div
                className={styles.errorSummary}
                ref={errorRef}
                role="alert"
                tabIndex={-1}
              >
                <a href="#simulation-email">{error}</a>
              </div>
            ) : null}
            <div className={styles.field}>
              <label htmlFor="simulation-email">Email address</label>
              <input
                aria-describedby="simulation-email-hint simulation-email-error"
                aria-invalid={Boolean(error)}
                autoComplete="email"
                id="simulation-email"
                maxLength={120}
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
              <p className={styles.hint} id="simulation-email-hint">
                Email remains unverified and local to this browser.
              </p>
              <p className={styles.error} id="simulation-email-error">
                {error}
              </p>
            </div>
            <div className={styles.formActions}>
              <button
                className={styles.primaryAction}
                disabled={!account.enabled}
                type="submit"
              >
                Continue as simulated customer
              </button>
              <button
                className={styles.secondaryAction}
                disabled={!account.enabled}
                onClick={account.continueAsGuest}
                type="button"
              >
                Continue as guest
              </button>
            </div>
            <p>
              No password is stored. No OTP is sent. No identity is verified. No
              real account is created.
            </p>
            <Link href="/contact">Privacy and help information</Link>
          </form>
        </Stack>
      </Container>
    </Section>
  );
}
