"use client";

import { useRef, useState, type FormEvent } from "react";
import { Container, Section, Stack } from "@/components/layout";
import { Breadcrumb } from "@/components/navigation";
import { useCustomerAccount } from "./CustomerAccountProvider";
import { AccountSimulationNotice } from "./SimulationNotice";
import {
  MAX_SIMULATED_ADDRESSES,
  type AddressInput,
  type SimulatedAddress,
} from "./types";
import styles from "./CustomerAccount.module.css";

const states = [
  "Andhra Pradesh",
  "Assam",
  "Bihar",
  "Delhi",
  "Gujarat",
  "Karnataka",
  "Maharashtra",
  "Odisha",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "West Bengal",
] as const;

const emptyAddress: AddressInput = {
  label: "Home",
  recipientName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  landmark: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  deliveryInstructions: "",
  isDefault: false,
};

export function SimulationAddressBookPage() {
  const account = useCustomerAccount();
  const [editing, setEditing] = useState<SimulatedAddress | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!account.hydrated)
    return (
      <Section>
        <Container>
          <p role="status">Restoring simulated addresses…</p>
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
              { label: "Addresses" },
            ]}
          />
          <div className={styles.pageHeader}>
            <p className={styles.eyebrow}>Local address book</p>
            <h1>Simulated addresses</h1>
            <p>
              {account.addresses.length} of {MAX_SIMULATED_ADDRESSES} local
              address slots used.
            </p>
          </div>
          <AccountSimulationNotice
            persistenceStatus={account.persistenceStatus}
          />
          {account.addresses.length ? (
            <div className={styles.addressGrid}>
              {account.addresses.map((address) => (
                <article className={styles.card} key={address.id}>
                  <span className={styles.tag}>
                    {address.label}
                    {address.isDefault ? " · Default" : ""}
                  </span>
                  <h2>{address.recipientName}</h2>
                  <address className={styles.address}>
                    {address.addressLine1}
                    {address.addressLine2 ? `, ${address.addressLine2}` : ""}
                    <br />
                    {address.city}, {address.state} {address.postalCode}
                    <br />
                    {address.country}
                  </address>
                  <p>Unverified phone: {address.phone}</p>
                  <div className={styles.inlineActions}>
                    <button
                      className={styles.secondaryAction}
                      onClick={() => {
                        setEditing(address);
                        setShowForm(true);
                      }}
                      type="button"
                    >
                      Edit {address.label} address
                    </button>
                    {!address.isDefault ? (
                      <button
                        className={styles.secondaryAction}
                        onClick={() => account.setDefaultAddress(address.id)}
                        type="button"
                      >
                        Set {address.label} as default
                      </button>
                    ) : null}
                    {deleteId === address.id ? (
                      <>
                        <button
                          className={styles.dangerAction}
                          onClick={() => {
                            account.deleteAddress(address.id);
                            setDeleteId(null);
                          }}
                          type="button"
                        >
                          Confirm delete {address.label} address
                        </button>
                        <button
                          className={styles.secondaryAction}
                          onClick={() => setDeleteId(null)}
                          type="button"
                        >
                          Keep address
                        </button>
                      </>
                    ) : (
                      <button
                        className={styles.dangerAction}
                        onClick={() => setDeleteId(address.id)}
                        type="button"
                      >
                        Delete {address.label} address
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.empty} role="status">
              <h2>Your simulated address book is empty</h2>
              <p>No address has been sent to a server.</p>
            </div>
          )}
          {!showForm ? (
            <button
              className={styles.primaryAction}
              disabled={
                !account.enabled ||
                account.addresses.length >= MAX_SIMULATED_ADDRESSES
              }
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              type="button"
            >
              {account.addresses.length >= MAX_SIMULATED_ADDRESSES
                ? "Maximum simulated addresses reached"
                : "Add simulated address"}
            </button>
          ) : (
            <AddressForm
              address={editing}
              onCancel={() => {
                setEditing(null);
                setShowForm(false);
              }}
              onSaved={() => {
                setEditing(null);
                setShowForm(false);
              }}
            />
          )}
        </Stack>
      </Container>
    </Section>
  );
}

function AddressForm({
  address,
  onCancel,
  onSaved,
}: {
  address: SimulatedAddress | null;
  onCancel(): void;
  onSaved(): void;
}) {
  const account = useCustomerAccount();
  const [input, setInput] = useState<AddressInput>(
    address
      ? {
          label: address.label,
          recipientName: address.recipientName,
          phone: address.phone,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          landmark: address.landmark,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
          deliveryInstructions: address.deliveryInstructions,
          isDefault: address.isDefault,
        }
      : emptyAddress,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);

  function field<K extends keyof AddressInput>(key: K, value: AddressInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = account.saveAddress(input, address?.id);
    if (result.ok) {
      onSaved();
      return;
    }
    setErrors(result.errors);
    setFormError(result.reason);
    queueMicrotask(() => summaryRef.current?.focus());
  }

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <h2>{address ? "Edit" : "Add"} simulated address</h2>
      {formError ? (
        <div
          className={styles.errorSummary}
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
        >
          <strong>{formError}</strong>
          <ul>
            {Object.entries(errors).map(([id, message]) => (
              <li key={id}>
                <a href={`#address-${id}`}>{message}</a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label htmlFor="address-label">Address label *</label>
          <select
            id="address-label"
            onChange={(event) =>
              field("label", event.target.value as AddressInput["label"])
            }
            value={input.label}
          >
            <option>Home</option>
            <option>Work</option>
            <option>Other</option>
          </select>
        </div>
        <AddressField
          autoComplete="name"
          error={errors.recipientName}
          id="recipientName"
          label="Recipient name"
          onChange={(value) => field("recipientName", value)}
          value={input.recipientName}
        />
        <AddressField
          autoComplete="tel"
          error={errors.phone}
          id="phone"
          label="Phone number"
          onChange={(value) => field("phone", value)}
          type="tel"
          value={input.phone}
        />
        <AddressField
          autoComplete="address-line1"
          error={errors.addressLine1}
          id="addressLine1"
          label="Address line 1"
          onChange={(value) => field("addressLine1", value)}
          value={input.addressLine1}
          wide
        />
        <AddressField
          autoComplete="address-line2"
          id="addressLine2"
          label="Address line 2"
          onChange={(value) => field("addressLine2", value)}
          required={false}
          value={input.addressLine2 ?? ""}
          wide
        />
        <AddressField
          id="landmark"
          label="Landmark"
          onChange={(value) => field("landmark", value)}
          required={false}
          value={input.landmark ?? ""}
        />
        <AddressField
          autoComplete="address-level2"
          error={errors.city}
          id="city"
          label="City"
          onChange={(value) => field("city", value)}
          value={input.city}
        />
        <div className={styles.field}>
          <label htmlFor="address-state">State *</label>
          <select
            aria-invalid={Boolean(errors.state)}
            autoComplete="address-level1"
            id="address-state"
            onChange={(event) => field("state", event.target.value)}
            value={input.state}
          >
            <option value="">Choose a state</option>
            {states.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
          <p className={styles.error}>{errors.state}</p>
        </div>
        <AddressField
          autoComplete="postal-code"
          error={errors.postalCode}
          id="postalCode"
          label="Postal code"
          onChange={(value) => field("postalCode", value)}
          value={input.postalCode}
        />
        <AddressField
          autoComplete="country-name"
          error={errors.country}
          id="country"
          label="Country"
          onChange={(value) => field("country", value)}
          value={input.country}
        />
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label htmlFor="address-deliveryInstructions">
            Delivery instructions
          </label>
          <textarea
            id="address-deliveryInstructions"
            maxLength={200}
            onChange={(event) =>
              field("deliveryInstructions", event.target.value)
            }
            value={input.deliveryInstructions ?? ""}
          />
        </div>
        <label className={styles.fieldWide}>
          <input
            checked={input.isDefault}
            onChange={(event) => field("isDefault", event.target.checked)}
            type="checkbox"
          />{" "}
          Set as default simulated address
        </label>
      </div>
      <div className={styles.formActions}>
        <button className={styles.primaryAction} type="submit">
          Save simulated address
        </button>
        <button
          className={styles.secondaryAction}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddressField({
  autoComplete,
  error,
  id,
  label,
  onChange,
  required = true,
  type = "text",
  value,
  wide = false,
}: {
  autoComplete?: string;
  error?: string;
  id: string;
  label: string;
  onChange(value: string): void;
  required?: boolean;
  type?: string;
  value: string;
  wide?: boolean;
}) {
  const fieldId = `address-${id}`;
  return (
    <div className={`${styles.field} ${wide ? styles.fieldWide : ""}`}>
      <label htmlFor={fieldId}>
        {label}
        {required ? " *" : ""}
      </label>
      <input
        aria-describedby={`${fieldId}-error`}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        id={fieldId}
        maxLength={id === "addressLine1" || id === "addressLine2" ? 120 : 80}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
      <p className={styles.error} id={`${fieldId}-error`}>
        {error}
      </p>
    </div>
  );
}
