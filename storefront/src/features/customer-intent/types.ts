import type {
  CatalogueAvailability,
  CatalogueProduct,
  CataloguePurity,
} from "@/features/catalogue-simulation/types";

export const CUSTOMER_INTENT_SCHEMA_VERSION = 1;
export const MAX_SIMULATED_QUANTITY = 8;

export interface CustomerIntentProduct {
  productId: string;
  slug: string;
  name: string;
  imageLabel: string;
  category: string;
  unitPriceMinor: number;
  currency: "INR";
  variantId?: string;
  size?: string;
  purity?: CataloguePurity;
  weight?: string;
  availability: CatalogueAvailability;
}

export interface CartItem extends CustomerIntentProduct {
  key: string;
  quantity: number;
}

export interface WishlistItem extends CustomerIntentProduct {
  key: string;
}

export interface PersistedCart {
  version: typeof CUSTOMER_INTENT_SCHEMA_VERSION;
  items: readonly CartItem[];
}

export interface PersistedWishlist {
  version: typeof CUSTOMER_INTENT_SCHEMA_VERSION;
  items: readonly WishlistItem[];
}

export interface CartTotals {
  distinctItemCount: number;
  itemQuantity: number;
  subtotalMinor: number;
  estimatedTotalMinor: number;
}

export type IntentResult =
  | { status: "added"; quantity: number }
  | { status: "merged"; quantity: number }
  | { status: "updated"; quantity: number }
  | { status: "removed"; quantity: 0 }
  | { status: "maximum"; quantity: number }
  | { status: "unavailable"; quantity: 0 }
  | { status: "invalid"; quantity: 0 };

export function productToIntent(
  product: CatalogueProduct,
  variantId?: string,
): CustomerIntentProduct {
  const variant =
    product.variants.find((item) => item.id === variantId) ??
    product.variants[0];
  return {
    productId: product.id,
    slug: product.slug,
    name: product.title,
    imageLabel: product.media[0]?.alt ?? `${product.title} placeholder`,
    category: product.category.title,
    unitPriceMinor: Math.round(product.price.amount * 100),
    currency: product.price.currency,
    variantId: variant?.id,
    size: variant?.size,
    purity: product.purity,
    weight: variant?.weight,
    availability: variant?.availability ?? product.availability,
  };
}
