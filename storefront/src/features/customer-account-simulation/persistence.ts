import { parsePersistedCustomerAccount } from "./domain";
import {
  CUSTOMER_ACCOUNT_STORAGE_KEY,
  type PersistedCustomerAccount,
} from "./types";

export interface AccountStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function restoreCustomerAccount(storage: AccountStorage | null) {
  if (!storage) return { status: "unavailable" as const, state: null };
  try {
    const raw = storage.getItem(CUSTOMER_ACCOUNT_STORAGE_KEY);
    if (raw === null) return { status: "empty" as const, state: null };
    const state = parsePersistedCustomerAccount(JSON.parse(raw));
    if (!state) {
      storage.removeItem(CUSTOMER_ACCOUNT_STORAGE_KEY);
      return { status: "invalid" as const, state: null };
    }
    return { status: "restored" as const, state };
  } catch {
    try {
      storage.removeItem(CUSTOMER_ACCOUNT_STORAGE_KEY);
    } catch {
      return { status: "unavailable" as const, state: null };
    }
    return { status: "invalid" as const, state: null };
  }
}

export function persistCustomerAccount(
  storage: AccountStorage | null,
  state: PersistedCustomerAccount,
) {
  if (!storage) return false;
  try {
    storage.setItem(CUSTOMER_ACCOUNT_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearPersistedCustomerAccount(storage: AccountStorage | null) {
  if (!storage) return false;
  try {
    storage.removeItem(CUSTOMER_ACCOUNT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
