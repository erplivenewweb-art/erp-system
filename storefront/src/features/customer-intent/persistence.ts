import { parsePersistedCart, parsePersistedWishlist } from "./domain";
import {
  CUSTOMER_INTENT_SCHEMA_VERSION,
  type CartItem,
  type WishlistItem,
} from "./types";

export const CART_STORAGE_KEY = "silver-sankha-development-cart-v1";
export const WISHLIST_STORAGE_KEY = "silver-sankha-development-wishlist-v1";

export interface IntentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type RestoreResult<T> =
  | { status: "restored"; items: readonly T[] }
  | { status: "empty"; items: readonly T[] }
  | { status: "invalid"; items: readonly T[] }
  | { status: "unavailable"; items: readonly T[] };

function restore<T>(
  storage: IntentStorage | null,
  key: string,
  parser: (value: unknown) => { items: readonly T[] } | null,
): RestoreResult<T> {
  if (!storage) return { status: "unavailable", items: [] };
  try {
    const raw = storage.getItem(key);
    if (raw === null) return { status: "empty", items: [] };
    const parsed = parser(JSON.parse(raw));
    if (!parsed) {
      storage.removeItem(key);
      return { status: "invalid", items: [] };
    }
    return { status: "restored", items: parsed.items };
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      return { status: "unavailable", items: [] };
    }
    return { status: "invalid", items: [] };
  }
}

export function restoreCart(storage: IntentStorage | null) {
  return restore<CartItem>(storage, CART_STORAGE_KEY, parsePersistedCart);
}

export function restoreWishlist(storage: IntentStorage | null) {
  return restore<WishlistItem>(
    storage,
    WISHLIST_STORAGE_KEY,
    parsePersistedWishlist,
  );
}

export function persistCart(
  storage: IntentStorage | null,
  items: readonly CartItem[],
) {
  return persist(storage, CART_STORAGE_KEY, {
    version: CUSTOMER_INTENT_SCHEMA_VERSION,
    items,
  });
}

export function persistWishlist(
  storage: IntentStorage | null,
  items: readonly WishlistItem[],
) {
  return persist(storage, WISHLIST_STORAGE_KEY, {
    version: CUSTOMER_INTENT_SCHEMA_VERSION,
    items,
  });
}

function persist(storage: IntentStorage | null, key: string, value: unknown) {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
