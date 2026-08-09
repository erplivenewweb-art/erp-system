import { defaultDiscoveryState, parseDiscoveryState } from "./domain";
import { DISCOVERY_STORAGE_KEY, type DiscoveryState } from "./types";

export function restoreDiscoveryState(storage: Storage | null) {
  if (!storage)
    return { state: defaultDiscoveryState, status: "unavailable" as const };
  try {
    const raw = storage.getItem(DISCOVERY_STORAGE_KEY);
    if (!raw) return { state: defaultDiscoveryState, status: "empty" as const };
    const parsed = parseDiscoveryState(JSON.parse(raw));
    if (parsed) return { state: parsed, status: "ready" as const };
    storage.removeItem(DISCOVERY_STORAGE_KEY);
    return { state: defaultDiscoveryState, status: "invalid" as const };
  } catch {
    try {
      storage.removeItem(DISCOVERY_STORAGE_KEY);
    } catch {
      /* unavailable storage */
    }
    return { state: defaultDiscoveryState, status: "invalid" as const };
  }
}

export function persistDiscoveryState(
  storage: Storage | null,
  state: DiscoveryState,
) {
  if (!storage) return false;
  try {
    storage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearDiscoveryState(storage: Storage | null) {
  if (!storage) return false;
  try {
    storage.removeItem(DISCOVERY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
