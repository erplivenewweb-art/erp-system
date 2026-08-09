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
  defaultDiscoveryFilters,
  defaultDiscoveryState,
  normalizeSearch,
  parseDiscoveryState,
} from "./domain";
import {
  clearDiscoveryState,
  persistDiscoveryState,
  restoreDiscoveryState,
} from "./persistence";
import {
  DISCOVERY_STORAGE_KEY,
  MAX_COMPARE_PRODUCTS,
  MAX_RECENTLY_VIEWED,
  type DiscoveryFilters,
  type DiscoveryPersistenceStatus,
  type DiscoveryState,
} from "./types";

interface DiscoveryContextValue {
  provided: boolean;
  enabled: boolean;
  hydrated: boolean;
  state: DiscoveryState;
  persistenceStatus: DiscoveryPersistenceStatus;
  setFilters(value: Partial<DiscoveryFilters>): void;
  resetFilters(): void;
  rememberSearch(value: string): void;
  clearSearchHistory(): void;
  markViewed(productId: string): void;
  clearRecentlyViewed(): void;
  toggleComparison(
    productId: string,
  ): "added" | "removed" | "limit" | "disabled";
  removeComparison(productId: string): void;
  clearComparison(): void;
  showMore(): void;
  rememberScroll(position: number): void;
}

const disabledContext: DiscoveryContextValue = {
  provided: false,
  enabled: false,
  hydrated: true,
  state: defaultDiscoveryState,
  persistenceStatus: "disabled",
  setFilters: () => undefined,
  resetFilters: () => undefined,
  rememberSearch: () => undefined,
  clearSearchHistory: () => undefined,
  markViewed: () => undefined,
  clearRecentlyViewed: () => undefined,
  toggleComparison: () => "disabled",
  removeComparison: () => undefined,
  clearComparison: () => undefined,
  showMore: () => undefined,
  rememberScroll: () => undefined,
};

const DiscoveryContext = createContext<DiscoveryContextValue>(disabledContext);
const browserStorage = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export function DiscoveryProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const [state, setState] = useState<DiscoveryState>(defaultDiscoveryState);
  const [hydrated, setHydrated] = useState(false);
  const [persistenceStatus, setPersistenceStatus] =
    useState<DiscoveryPersistenceStatus>(enabled ? "pending" : "disabled");

  useEffect(() => {
    queueMicrotask(() => {
      if (!enabled) {
        setHydrated(true);
        setPersistenceStatus("disabled");
        return;
      }
      const restored = restoreDiscoveryState(browserStorage());
      setState(restored.state);
      setHydrated(true);
      setPersistenceStatus(
        restored.status === "invalid"
          ? "recovered"
          : restored.status === "unavailable"
            ? "unavailable"
            : "ready",
      );
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const synchronize = (event: StorageEvent) => {
      if (event.key !== DISCOVERY_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = parseDiscoveryState(JSON.parse(event.newValue));
        if (parsed) setState(parsed);
      } catch {
        /* malformed events fail closed */
      }
    };
    window.addEventListener("storage", synchronize);
    return () => window.removeEventListener("storage", synchronize);
  }, [enabled]);

  const commit = useCallback(
    (transform: (current: DiscoveryState) => DiscoveryState) => {
      if (!enabled || !hydrated) return false;
      const next = transform(state);
      if (next === state) return true;
      const saved = persistDiscoveryState(browserStorage(), next);
      setState(next);
      setPersistenceStatus(saved ? "saved" : "unavailable");
      return saved;
    },
    [enabled, hydrated, state],
  );

  const value = useMemo<DiscoveryContextValue>(
    () => ({
      provided: true,
      enabled,
      hydrated,
      state,
      persistenceStatus,
      setFilters: (value) =>
        commit((current) => ({
          ...current,
          filters: { ...current.filters, ...value },
          visibleCount: 6,
        })),
      resetFilters: () =>
        commit((current) => ({
          ...current,
          filters: { ...defaultDiscoveryFilters },
          visibleCount: 6,
          scrollPosition: 0,
        })),
      rememberSearch: (value) => {
        const search = normalizeSearch(value);
        if (!search) return;
        commit((current) => ({
          ...current,
          recentSearches: [
            search,
            ...current.recentSearches.filter(
              (item) =>
                item.toLocaleLowerCase("en") !== search.toLocaleLowerCase("en"),
            ),
          ].slice(0, 8),
        }));
      },
      clearSearchHistory: () =>
        commit((current) => ({ ...current, recentSearches: [] })),
      markViewed: (productId) =>
        commit((current) =>
          current.recentlyViewed[0] === productId
            ? current
            : {
                ...current,
                recentlyViewed: [
                  productId,
                  ...current.recentlyViewed.filter((id) => id !== productId),
                ].slice(0, MAX_RECENTLY_VIEWED),
              },
        ),
      clearRecentlyViewed: () =>
        commit((current) => ({ ...current, recentlyViewed: [] })),
      toggleComparison: (productId) => {
        if (!enabled) return "disabled";
        if (state.comparison.includes(productId)) {
          commit((current) => ({
            ...current,
            comparison: current.comparison.filter((id) => id !== productId),
          }));
          return "removed";
        }
        if (state.comparison.length >= MAX_COMPARE_PRODUCTS) return "limit";
        commit((current) => ({
          ...current,
          comparison: [...current.comparison, productId],
        }));
        return "added";
      },
      removeComparison: (productId) =>
        commit((current) => ({
          ...current,
          comparison: current.comparison.filter((id) => id !== productId),
        })),
      clearComparison: () =>
        commit((current) => ({ ...current, comparison: [] })),
      showMore: () =>
        commit((current) => ({
          ...current,
          visibleCount: Math.min(60, current.visibleCount + 6),
        })),
      rememberScroll: (position) =>
        commit((current) => ({
          ...current,
          scrollPosition: Math.max(0, Math.round(position)),
        })),
    }),
    [commit, enabled, hydrated, persistenceStatus, state],
  );

  return (
    <DiscoveryContext.Provider value={value}>
      {children}
    </DiscoveryContext.Provider>
  );
}

export function useDiscovery() {
  return useContext(DiscoveryContext);
}

export function DiscoveryScope({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const current = useDiscovery();
  return current.provided ? (
    children
  ) : (
    <DiscoveryProvider enabled={enabled}>{children}</DiscoveryProvider>
  );
}

export function clearDiscoveryPersistence() {
  return clearDiscoveryState(browserStorage());
}
