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
import { developmentProducts } from "@/features/catalogue-simulation/fixtures";
import {
  addCartItem,
  addWishlistItem,
  calculateCartTotals,
  intentKey,
  isAvailable,
  isWishlistItem,
  removeCartItem,
  removeWishlistItem,
  setCartQuantity,
} from "./domain";
import {
  persistCart,
  persistWishlist,
  restoreCart,
  restoreWishlist,
} from "./persistence";
import {
  MAX_SIMULATED_QUANTITY,
  type CartItem,
  type CartTotals,
  type CustomerIntentProduct,
  type IntentResult,
  type WishlistItem,
} from "./types";
import styles from "./CustomerIntent.module.css";

type PersistenceStatus =
  "pending" | "ready" | "recovered" | "unavailable" | "disabled";

export interface CustomerIntentContextValue {
  enabled: boolean;
  hydrated: boolean;
  cartItems: readonly CartItem[];
  wishlistItems: readonly WishlistItem[];
  totals: CartTotals;
  cartOpen: boolean;
  persistenceStatus: PersistenceStatus;
  announcement: string;
  addToCart(product: CustomerIntentProduct, quantity?: number): IntentResult;
  addBundleToCart(products: readonly CustomerIntentProduct[]): number;
  setQuantity(key: string, quantity: number): IntentResult;
  removeFromCart(key: string): void;
  clearCart(): void;
  toggleWishlist(product: CustomerIntentProduct): boolean;
  removeFromWishlist(key: string): void;
  moveWishlistToCart(key: string): IntentResult;
  clearWishlist(): void;
  isWishlisted(product: CustomerIntentProduct): boolean;
  openCart(): void;
  closeCart(): void;
}

const emptyTotals = calculateCartTotals([]);
const disabledContext: CustomerIntentContextValue = {
  enabled: false,
  hydrated: false,
  cartItems: [],
  wishlistItems: [],
  totals: emptyTotals,
  cartOpen: false,
  persistenceStatus: "disabled",
  announcement: "",
  addToCart: () => ({ status: "invalid", quantity: 0 }),
  addBundleToCart: () => 0,
  setQuantity: () => ({ status: "invalid", quantity: 0 }),
  removeFromCart: () => undefined,
  clearCart: () => undefined,
  toggleWishlist: () => false,
  removeFromWishlist: () => undefined,
  moveWishlistToCart: () => ({ status: "invalid", quantity: 0 }),
  clearWishlist: () => undefined,
  isWishlisted: () => false,
  openCart: () => undefined,
  closeCart: () => undefined,
};

const CustomerIntentContext =
  createContext<CustomerIntentContextValue>(disabledContext);

export function CustomerIntentProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const [cartItems, setCartItems] = useState<readonly CartItem[]>([]);
  const [wishlistItems, setWishlistItems] = useState<readonly WishlistItem[]>(
    [],
  );
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>(
    enabled ? "pending" : "disabled",
  );

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (!enabled) {
        setHydrated(true);
        setPersistenceStatus("disabled");
        return;
      }
      const storage = browserStorage();
      const cart = restoreCart(storage);
      const wishlist = restoreWishlist(storage);
      const knownProducts = new Set(
        developmentProducts.map((product) => product.id),
      );
      const safeCart = cart.items.filter((item) =>
        knownProducts.has(item.productId),
      );
      const safeWishlist = wishlist.items.filter((item) =>
        knownProducts.has(item.productId),
      );
      setCartItems(safeCart);
      setWishlistItems(safeWishlist);
      setPersistenceStatus(
        cart.status === "unavailable" || wishlist.status === "unavailable"
          ? "unavailable"
          : cart.status === "invalid" ||
              wishlist.status === "invalid" ||
              safeCart.length !== cart.items.length ||
              safeWishlist.length !== wishlist.items.length
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
    const storage = browserStorage();
    if (
      !persistCart(storage, cartItems) ||
      !persistWishlist(storage, wishlistItems)
    ) {
      queueMicrotask(() => setPersistenceStatus("unavailable"));
    }
  }, [cartItems, enabled, hydrated, wishlistItems]);

  const announce = useCallback((message: string) => {
    setAnnouncement("");
    queueMicrotask(() => setAnnouncement(message));
  }, []);

  useEffect(() => {
    if (!announcement) return;
    const timeout = window.setTimeout(() => setAnnouncement(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [announcement]);

  const addToCart = useCallback(
    (product: CustomerIntentProduct, quantity = 1): IntentResult => {
      if (!enabled || !isAvailable(product)) {
        announce(`${product.name} is unavailable for the simulated cart.`);
        return { status: "unavailable", quantity: 0 };
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        announce("The simulated quantity is invalid.");
        return { status: "invalid", quantity: 0 };
      }
      const key = intentKey(product);
      const existing = cartItems.find((item) => item.key === key);
      const next = addCartItem(cartItems, product, quantity);
      const nextItem = next.find((item) => item.key === key);
      setCartItems(next);
      const status =
        existing && existing.quantity === MAX_SIMULATED_QUANTITY
          ? "maximum"
          : existing
            ? "merged"
            : "added";
      const result: IntentResult = {
        status,
        quantity: nextItem?.quantity ?? 0,
      };
      announce(
        status === "maximum"
          ? `${product.name} is already at the simulated maximum quantity.`
          : status === "merged"
            ? `${product.name} quantity updated to ${result.quantity} in the simulated cart.`
            : `${product.name} added to the simulated cart.`,
      );
      return result;
    },
    [announce, cartItems, enabled],
  );

  const setQuantity = useCallback(
    (key: string, quantity: number): IntentResult => {
      const item = cartItems.find((candidate) => candidate.key === key);
      if (!item || !Number.isInteger(quantity))
        return { status: "invalid", quantity: 0 };
      if (quantity < 1) {
        setCartItems(removeCartItem(cartItems, key));
        announce(`${item.name} removed from the simulated cart.`);
        return { status: "removed", quantity: 0 };
      }
      const bounded = Math.min(quantity, MAX_SIMULATED_QUANTITY);
      setCartItems(setCartQuantity(cartItems, key, bounded));
      announce(
        bounded === MAX_SIMULATED_QUANTITY && quantity > MAX_SIMULATED_QUANTITY
          ? `Maximum simulated quantity is ${MAX_SIMULATED_QUANTITY}.`
          : `${item.name} quantity updated to ${bounded}.`,
      );
      return {
        status:
          bounded === MAX_SIMULATED_QUANTITY &&
          quantity > MAX_SIMULATED_QUANTITY
            ? "maximum"
            : "updated",
        quantity: bounded,
      };
    },
    [announce, cartItems],
  );

  const addBundleToCart = useCallback(
    (products: readonly CustomerIntentProduct[]) => {
      if (!enabled) return 0;
      const available = products.filter(isAvailable);
      if (!available.length) {
        announce("No available pieces could be added to the simulated cart.");
        return 0;
      }
      setCartItems((current) =>
        available.reduce(
          (next, product) => addCartItem(next, product),
          current,
        ),
      );
      announce(
        `${available.length} ${available.length === 1 ? "piece" : "pieces"} added to the simulated cart together.`,
      );
      return available.length;
    },
    [announce, enabled],
  );

  const removeFromCart = useCallback(
    (key: string) => {
      const item = cartItems.find((candidate) => candidate.key === key);
      setCartItems(removeCartItem(cartItems, key));
      if (item) announce(`${item.name} removed from the simulated cart.`);
    },
    [announce, cartItems],
  );

  const clearCart = useCallback(() => {
    setCartItems([]);
    announce("Simulated cart cleared.");
  }, [announce]);

  const toggleWishlist = useCallback(
    (product: CustomerIntentProduct) => {
      if (!enabled) return false;
      const selected = isWishlistItem(wishlistItems, product);
      setWishlistItems(
        selected
          ? removeWishlistItem(wishlistItems, intentKey(product))
          : addWishlistItem(wishlistItems, product),
      );
      announce(
        selected
          ? `${product.name} removed from the development wishlist.`
          : `${product.name} saved to the development wishlist.`,
      );
      return !selected;
    },
    [announce, enabled, wishlistItems],
  );

  const removeFromWishlist = useCallback(
    (key: string) => {
      const item = wishlistItems.find((candidate) => candidate.key === key);
      setWishlistItems(removeWishlistItem(wishlistItems, key));
      if (item) announce(`${item.name} removed from the development wishlist.`);
    },
    [announce, wishlistItems],
  );

  const moveWishlistToCart = useCallback(
    (key: string): IntentResult => {
      const item = wishlistItems.find((candidate) => candidate.key === key);
      if (!item) return { status: "invalid", quantity: 0 };
      if (!isAvailable(item)) {
        announce(`${item.name} is unavailable for the simulated cart.`);
        return { status: "unavailable", quantity: 0 };
      }
      const existing = cartItems.find((candidate) => candidate.key === key);
      const nextCart = addCartItem(cartItems, item);
      const quantity = nextCart.find((candidate) => candidate.key === key)?.quantity ?? 0;
      setCartItems(nextCart);
      setWishlistItems(removeWishlistItem(wishlistItems, key));
      announce(`${item.name} moved to the simulated cart.`);
      return { status: existing ? "merged" : "added", quantity };
    },
    [announce, cartItems, wishlistItems],
  );

  const clearWishlist = useCallback(() => {
    setWishlistItems([]);
    announce("Development wishlist cleared.");
  }, [announce]);

  const totals = useMemo(() => calculateCartTotals(cartItems), [cartItems]);
  const value = useMemo<CustomerIntentContextValue>(
    () => ({
      enabled,
      hydrated,
      cartItems,
      wishlistItems,
      totals,
      cartOpen,
      persistenceStatus,
      announcement,
      addToCart,
      addBundleToCart,
      setQuantity,
      removeFromCart,
      clearCart,
      toggleWishlist,
      removeFromWishlist,
      moveWishlistToCart,
      clearWishlist,
      isWishlisted: (product) => isWishlistItem(wishlistItems, product),
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
    }),
    [
      addToCart,
      addBundleToCart,
      announcement,
      cartItems,
      cartOpen,
      clearCart,
      clearWishlist,
      enabled,
      hydrated,
      persistenceStatus,
      removeFromCart,
      removeFromWishlist,
      moveWishlistToCart,
      setQuantity,
      toggleWishlist,
      totals,
      wishlistItems,
    ],
  );

  return (
    <CustomerIntentContext.Provider value={value}>
      {children}
      {announcement ? (
        <div aria-atomic="true" aria-live="polite" className={styles.intentToast}>
          {announcement}
        </div>
      ) : null}
    </CustomerIntentContext.Provider>
  );
}

export function useCustomerIntent() {
  return useContext(CustomerIntentContext);
}

function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
