"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  addAddress,
  addressesEqual,
  createGuestSession,
  createSignedInSession,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
  validateAddress,
  validateProfile,
  validateSignInEmail,
} from "./domain";
import {
  clearPersistedCustomerAccount,
  persistCustomerAccount,
  restoreCustomerAccount,
} from "./persistence";
import {
  CUSTOMER_ACCOUNT_SCHEMA_VERSION,
  CUSTOMER_ACCOUNT_STORAGE_KEY,
  FIXTURE_CREATED_AT,
  MAX_SIMULATED_ADDRESSES,
  type AddressInput,
  type CheckoutSelections,
  type CustomerProfile,
  type PersistedCustomerAccount,
  type ProfileInput,
  type SimulatedAddress,
  type SimulatedCustomerSession,
} from "./types";
import styles from "./CustomerAccount.module.css";

type PersistenceStatus =
  "pending" | "ready" | "recovered" | "unavailable" | "disabled";

export interface CustomerAccountContextValue {
  enabled: boolean;
  hydrated: boolean;
  session: SimulatedCustomerSession | null;
  profile: CustomerProfile | null;
  addresses: readonly SimulatedAddress[];
  checkout: CheckoutSelections;
  persistenceStatus: PersistenceStatus;
  announcement: string;
  startSimulatedSession(
    email: string,
  ): { ok: true } | { ok: false; error: string };
  continueAsGuest(): void;
  saveProfile(input: ProfileInput): ReturnType<typeof validateProfile>;
  clearSession(): void;
  resetAccount(): void;
  saveAddress(
    input: AddressInput,
    editId?: string,
  ):
    | { ok: true; id: string }
    | { ok: false; errors: Record<string, string>; reason: string };
  deleteAddress(id: string): void;
  setDefaultAddress(id: string): void;
  setCheckout(selection: Partial<CheckoutSelections>): void;
}

const emptyCheckout: CheckoutSelections = { acknowledged: false };
const disabledContext: CustomerAccountContextValue = {
  enabled: false,
  hydrated: true,
  session: null,
  profile: null,
  addresses: [],
  checkout: emptyCheckout,
  persistenceStatus: "disabled",
  announcement: "",
  startSimulatedSession: () => ({
    ok: false,
    error: "Customer simulation is disabled.",
  }),
  continueAsGuest: () => undefined,
  saveProfile: (input) => validateProfile(input),
  clearSession: () => undefined,
  resetAccount: () => undefined,
  saveAddress: () => ({
    ok: false,
    errors: {},
    reason: "Customer simulation is disabled.",
  }),
  deleteAddress: () => undefined,
  setDefaultAddress: () => undefined,
  setCheckout: () => undefined,
};

const CustomerAccountContext =
  createContext<CustomerAccountContextValue>(disabledContext);

function emptyState(): PersistedCustomerAccount {
  return {
    version: CUSTOMER_ACCOUNT_SCHEMA_VERSION,
    session: null,
    profile: null,
    addresses: [],
    checkout: emptyCheckout,
  };
}

export function CustomerAccountProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const [state, setState] = useState<PersistedCustomerAccount>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>(
    enabled ? "pending" : "disabled",
  );
  const [announcement, setAnnouncement] = useState("");

  const announce = useCallback((message: string) => {
    setAnnouncement("");
    queueMicrotask(() => setAnnouncement(message));
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (!enabled) {
        setHydrated(true);
        setPersistenceStatus("disabled");
        return;
      }
      const restored = restoreCustomerAccount(browserStorage());
      if (restored.state) setState(restored.state);
      setPersistenceStatus(
        restored.status === "unavailable"
          ? "unavailable"
          : restored.status === "invalid"
            ? "recovered"
            : "ready",
      );
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !hydrated) return;
    if (!persistCustomerAccount(browserStorage(), state))
      queueMicrotask(() => setPersistenceStatus("unavailable"));
  }, [enabled, hydrated, state]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    function sync(event: StorageEvent) {
      if (event.key !== CUSTOMER_ACCOUNT_STORAGE_KEY) return;
      const restored = restoreCustomerAccount(browserStorage());
      if (restored.state) {
        setState(restored.state);
        announce("Account simulation synchronized from another tab.");
      } else if (event.newValue === null) {
        setState(emptyState());
      }
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [announce, enabled]);

  const startSimulatedSession = useCallback(
    (rawEmail: string) => {
      if (!enabled)
        return {
          ok: false as const,
          error: "Customer simulation is disabled.",
        };
      const checked = validateSignInEmail(rawEmail);
      if (!checked.valid) return { ok: false as const, error: checked.error };
      setState((current) => ({
        ...current,
        session: createSignedInSession(checked.email),
        profile:
          current.profile?.email === checked.email
            ? current.profile
            : {
                firstName: "",
                lastName: "",
                displayName: checked.email.split("@")[0],
                email: checked.email,
                marketingPreference: false,
                shoppingPreference: "retail",
                createdAt: FIXTURE_CREATED_AT,
                updatedAt: new Date().toISOString(),
                completeness: "partial",
              },
      }));
      announce("Simulated customer session started. Identity is unverified.");
      return { ok: true as const };
    },
    [announce, enabled],
  );

  const continueAsGuest = useCallback(() => {
    if (!enabled) return;
    setState((current) => ({ ...current, session: createGuestSession() }));
    announce("Continuing as a simulated guest.");
  }, [announce, enabled]);

  const saveProfile = useCallback(
    (input: ProfileInput) => {
      const checked = validateProfile(
        input,
        new Date().toISOString(),
        state.profile?.createdAt,
      );
      if (checked.valid && checked.value && enabled) {
        setState((current) => ({
          ...current,
          profile: checked.value ?? null,
          session:
            current.session?.status === "simulated-signed-in"
              ? {
                  ...current.session,
                  customerId: createSignedInSession(checked.value!.email)
                    .customerId,
                }
              : current.session,
        }));
        announce("Simulated profile saved in this browser.");
      }
      return checked;
    },
    [announce, enabled, state.profile?.createdAt],
  );

  const clearSession = useCallback(() => {
    setState((current) => ({ ...current, session: null }));
    announce("Simulated session cleared.");
  }, [announce]);

  const resetAccount = useCallback(() => {
    setState(emptyState());
    clearPersistedCustomerAccount(browserStorage());
    announce("Local simulated account data cleared.");
  }, [announce]);

  const saveAddress = useCallback(
    (input: AddressInput, editId?: string) => {
      if (!enabled)
        return {
          ok: false as const,
          errors: {},
          reason: "Customer simulation is disabled.",
        };
      const existing = editId
        ? state.addresses.find((item) => item.id === editId)
        : undefined;
      const id =
        editId ??
        `sim-address-${
          state.addresses.reduce((maximum, item) => {
            const suffix = Number(item.id.split("-").at(-1));
            return Number.isFinite(suffix)
              ? Math.max(maximum, suffix)
              : maximum;
          }, 0) + 1
        }`;
      const checked = validateAddress(
        input,
        id,
        new Date().toISOString(),
        existing?.createdAt,
      );
      if (!checked.valid || !checked.value)
        return {
          ok: false as const,
          errors: checked.errors,
          reason: "Correct the highlighted address fields.",
        };
      if (!editId && state.addresses.length >= MAX_SIMULATED_ADDRESSES)
        return {
          ok: false as const,
          errors: {},
          reason: `A maximum of ${MAX_SIMULATED_ADDRESSES} simulated addresses is allowed.`,
        };
      if (
        state.addresses.some(
          (item) => item.id !== editId && addressesEqual(item, checked.value!),
        )
      )
        return {
          ok: false as const,
          errors: {},
          reason: "This simulated address is already saved.",
        };
      setState((current) => ({
        ...current,
        addresses: editId
          ? updateAddress(current.addresses, checked.value!)
          : addAddress(current.addresses, checked.value!),
        checkout: {
          ...current.checkout,
          addressId:
            checked.value!.isDefault || current.addresses.length === 0
              ? checked.value!.id
              : current.checkout.addressId,
        },
      }));
      announce(`Simulated address ${editId ? "updated" : "saved"}.`);
      return { ok: true as const, id };
    },
    [announce, enabled, state.addresses],
  );

  const removeAddress = useCallback(
    (id: string) => {
      setState((current) => {
        const addresses = deleteAddress(current.addresses, id);
        return {
          ...current,
          addresses,
          checkout: {
            ...current.checkout,
            addressId:
              current.checkout.addressId === id
                ? addresses.find((item) => item.isDefault)?.id
                : current.checkout.addressId,
          },
        };
      });
      announce("Simulated address deleted.");
    },
    [announce],
  );

  const chooseDefault = useCallback(
    (id: string) => {
      setState((current) => ({
        ...current,
        addresses: setDefaultAddress(current.addresses, id),
        checkout: { ...current.checkout, addressId: id },
      }));
      announce("Default simulated address updated.");
    },
    [announce],
  );

  const setCheckout = useCallback(
    (selection: Partial<CheckoutSelections>) => {
      if (!enabled) return;
      setState((current) => ({
        ...current,
        checkout: { ...current.checkout, ...selection },
      }));
    },
    [enabled],
  );

  const value = useMemo<CustomerAccountContextValue>(
    () => ({
      enabled,
      hydrated,
      session: state.session,
      profile: state.profile,
      addresses: state.addresses,
      checkout: state.checkout,
      persistenceStatus,
      announcement,
      startSimulatedSession,
      continueAsGuest,
      saveProfile,
      clearSession,
      resetAccount,
      saveAddress,
      deleteAddress: removeAddress,
      setDefaultAddress: chooseDefault,
      setCheckout,
    }),
    [
      announcement,
      chooseDefault,
      clearSession,
      continueAsGuest,
      enabled,
      hydrated,
      persistenceStatus,
      removeAddress,
      resetAccount,
      saveAddress,
      saveProfile,
      setCheckout,
      startSimulatedSession,
      state,
    ],
  );

  return (
    <CustomerAccountContext.Provider value={value}>
      {children}
      <p
        aria-atomic="true"
        aria-live="polite"
        className={styles.visuallyHidden}
      >
        {announcement}
      </p>
    </CustomerAccountContext.Provider>
  );
}

export function useCustomerAccount() {
  return useContext(CustomerAccountContext);
}

function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
