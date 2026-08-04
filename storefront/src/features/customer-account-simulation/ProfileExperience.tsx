"use client";

import { useRef, useState, type FormEvent } from "react";
import { Container, Section, Stack } from "@/components/layout";
import { Breadcrumb } from "@/components/navigation";
import { useCustomerAccount } from "./CustomerAccountProvider";
import { AccountSimulationNotice } from "./SimulationNotice";
import type { ProfileInput } from "./types";
import styles from "./CustomerAccount.module.css";

export function SimulationProfilePage() {
  const account = useCustomerAccount();
  if (!account.hydrated)
    return (
      <Section>
        <Container>
          <p role="status">Restoring simulated profile…</p>
        </Container>
      </Section>
    );
  return (
    <Section>
      <Container>
        <Stack gap="lg">
          <Breadcrumb
            items={[
              { href: "/", label: "Home" },
              { href: "/account", label: "Account" },
              { label: "Profile" },
            ]}
          />
          <div className={styles.pageHeader}>
            <p className={styles.eyebrow}>Local customer profile</p>
            <h1>Simulated profile</h1>
            <p>
              Profile data stays in this browser. No backend account exists.
            </p>
          </div>
          <AccountSimulationNotice
            persistenceStatus={account.persistenceStatus}
          />
          <ProfileForm key={account.profile?.updatedAt ?? "empty"} />
        </Stack>
      </Container>
    </Section>
  );
}

function ProfileForm() {
  const account = useCustomerAccount();
  const [input, setInput] = useState<ProfileInput>({
    firstName: account.profile?.firstName ?? "",
    lastName: account.profile?.lastName ?? "",
    email: account.profile?.email ?? "",
    phone: account.profile?.phone ?? "",
    marketingPreference: account.profile?.marketingPreference ?? false,
    shoppingPreference: account.profile?.shoppingPreference ?? "retail",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = account.saveProfile(input);
    setErrors(result.errors);
    setSaved(result.valid);
    if (!result.valid) queueMicrotask(() => summaryRef.current?.focus());
  }

  function field<K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      {Object.keys(errors).length ? (
        <div
          className={styles.errorSummary}
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
        >
          <strong>Correct the profile fields:</strong>
          <ul>
            {Object.entries(errors).map(([id, message]) => (
              <li key={id}>
                <a href={`#profile-${id}`}>{message}</a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className={styles.formGrid}>
        <TextField
          error={errors.firstName}
          id="firstName"
          label="First name"
          onChange={(value) => field("firstName", value)}
          value={input.firstName}
        />
        <TextField
          error={errors.lastName}
          id="lastName"
          label="Last name"
          onChange={(value) => field("lastName", value)}
          value={input.lastName}
        />
        <TextField
          autoComplete="email"
          error={errors.email}
          hint="Unverified. No confirmation email is sent."
          id="email"
          label="Email"
          onChange={(value) => field("email", value)}
          type="email"
          value={input.email}
        />
        <TextField
          autoComplete="tel"
          error={errors.phone}
          hint="Optional and unverified. Use a fictional Indian mobile number."
          id="phone"
          label="Phone number"
          onChange={(value) => field("phone", value)}
          type="tel"
          value={input.phone ?? ""}
        />
        <div className={styles.field}>
          <label htmlFor="profile-shoppingPreference">
            Shopping preference
          </label>
          <select
            id="profile-shoppingPreference"
            onChange={(event) =>
              field(
                "shoppingPreference",
                event.target.value as ProfileInput["shoppingPreference"],
              )
            }
            value={input.shoppingPreference}
          >
            <option value="retail">Retail</option>
            <option value="wholesale-interest">Wholesale interest</option>
          </select>
        </div>
        <div className={styles.field}>
          <label>
            <input
              checked={input.marketingPreference}
              onChange={(event) =>
                field("marketingPreference", event.target.checked)
              }
              type="checkbox"
            />{" "}
            Save fictional marketing preference
          </label>
          <p className={styles.hint}>No message will be sent.</p>
        </div>
      </div>
      <button
        className={styles.primaryAction}
        disabled={!account.enabled}
        type="submit"
      >
        Save simulated profile
      </button>
      <p aria-live="polite" role="status">
        {saved ? "Simulated profile saved in this browser." : ""}
      </p>
    </form>
  );
}

function TextField({
  autoComplete,
  error,
  hint,
  id,
  label,
  onChange,
  type = "text",
  value,
}: {
  autoComplete?: string;
  error?: string;
  hint?: string;
  id: string;
  label: string;
  onChange(value: string): void;
  type?: string;
  value: string;
}) {
  const fieldId = `profile-${id}`;
  return (
    <div className={styles.field}>
      <label htmlFor={fieldId}>
        {label}
        {id !== "phone" ? " *" : ""}
      </label>
      <input
        aria-describedby={`${fieldId}-hint ${fieldId}-error`}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        id={fieldId}
        maxLength={id === "email" ? 120 : 50}
        onChange={(event) => onChange(event.target.value)}
        required={id !== "phone"}
        type={type}
        value={value}
      />
      <p className={styles.hint} id={`${fieldId}-hint`}>
        {hint}
      </p>
      <p className={styles.error} id={`${fieldId}-error`}>
        {error}
      </p>
    </div>
  );
}
