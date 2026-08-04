import {
  CUSTOMER_INTENT_SCHEMA_VERSION,
  MAX_SIMULATED_QUANTITY,
  type CartItem,
  type CartTotals,
  type CustomerIntentProduct,
  type PersistedCart,
  type PersistedWishlist,
  type WishlistItem,
} from "./types";

export function intentKey(
  item: Pick<CustomerIntentProduct, "productId" | "variantId">,
) {
  return `${item.productId}:${item.variantId ?? "default"}`;
}

export function isAvailable(item: CustomerIntentProduct) {
  return item.availability !== "OUT_OF_STOCK";
}

export function addCartItem(
  items: readonly CartItem[],
  product: CustomerIntentProduct,
  quantity = 1,
) {
  if (!isAvailable(product) || !Number.isInteger(quantity) || quantity < 1)
    return items;
  const key = intentKey(product);
  const existing = items.find((item) => item.key === key);
  if (!existing) {
    return [
      ...items,
      { ...product, key, quantity: Math.min(quantity, MAX_SIMULATED_QUANTITY) },
    ];
  }
  return items.map((item) =>
    item.key === key
      ? {
          ...item,
          quantity: Math.min(item.quantity + quantity, MAX_SIMULATED_QUANTITY),
        }
      : item,
  );
}

export function setCartQuantity(
  items: readonly CartItem[],
  key: string,
  quantity: number,
) {
  if (!Number.isInteger(quantity)) return items;
  if (quantity < 1) return items.filter((item) => item.key !== key);
  return items.map((item) =>
    item.key === key
      ? { ...item, quantity: Math.min(quantity, MAX_SIMULATED_QUANTITY) }
      : item,
  );
}

export function removeCartItem(items: readonly CartItem[], key: string) {
  return items.filter((item) => item.key !== key);
}

export function calculateCartTotals(items: readonly CartItem[]): CartTotals {
  const itemQuantity = items.reduce((total, item) => total + item.quantity, 0);
  const subtotalMinor = items.reduce(
    (total, item) => total + item.unitPriceMinor * item.quantity,
    0,
  );
  return {
    distinctItemCount: items.length,
    itemQuantity,
    subtotalMinor,
    estimatedTotalMinor: subtotalMinor,
  };
}

export function addWishlistItem(
  items: readonly WishlistItem[],
  product: CustomerIntentProduct,
) {
  const key = intentKey(product);
  return items.some((item) => item.key === key)
    ? items
    : [...items, { ...product, key }];
}

export function removeWishlistItem(
  items: readonly WishlistItem[],
  key: string,
) {
  return items.filter((item) => item.key !== key);
}

export function isWishlistItem(
  items: readonly WishlistItem[],
  product: CustomerIntentProduct,
) {
  return items.some((item) => item.key === intentKey(product));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validAvailability(value: unknown) {
  return (
    value === "IN_STOCK" ||
    value === "LOW_STOCK" ||
    value === "MADE_TO_ORDER" ||
    value === "OUT_OF_STOCK"
  );
}

function validBase(value: unknown): value is WishlistItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.key === "string" &&
    typeof value.productId === "string" &&
    typeof value.slug === "string" &&
    typeof value.name === "string" &&
    typeof value.imageLabel === "string" &&
    typeof value.category === "string" &&
    Number.isSafeInteger(value.unitPriceMinor) &&
    Number(value.unitPriceMinor) >= 0 &&
    value.currency === "INR" &&
    validAvailability(value.availability) &&
    (value.variantId === undefined || typeof value.variantId === "string") &&
    (value.size === undefined || typeof value.size === "string") &&
    (value.weight === undefined || typeof value.weight === "string") &&
    (value.purity === undefined ||
      value.purity === "925_SILVER" ||
      value.purity === "999_SILVER" ||
      value.purity === "GOLD_PLATED")
  );
}

export function parsePersistedCart(value: unknown): PersistedCart | null {
  if (
    !isRecord(value) ||
    value.version !== CUSTOMER_INTENT_SCHEMA_VERSION ||
    !Array.isArray(value.items)
  )
    return null;
  if (
    !value.items.every(
      (item) =>
        validBase(item) &&
        isRecord(item) &&
        Number.isInteger(item.quantity) &&
        Number(item.quantity) >= 1 &&
        Number(item.quantity) <= MAX_SIMULATED_QUANTITY,
    )
  )
    return null;
  const unique = new Set(value.items.map((item) => item.key));
  return unique.size === value.items.length
    ? {
        version: CUSTOMER_INTENT_SCHEMA_VERSION,
        items: value.items as CartItem[],
      }
    : null;
}

export function parsePersistedWishlist(
  value: unknown,
): PersistedWishlist | null {
  if (
    !isRecord(value) ||
    value.version !== CUSTOMER_INTENT_SCHEMA_VERSION ||
    !Array.isArray(value.items) ||
    !value.items.every(validBase)
  )
    return null;
  const unique = new Set(value.items.map((item) => item.key));
  return unique.size === value.items.length
    ? {
        version: CUSTOMER_INTENT_SCHEMA_VERSION,
        items: value.items as WishlistItem[],
      }
    : null;
}

export function formatSimulatedPrice(minor: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(minor / 100);
}
