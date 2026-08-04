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
import { cloneSiteConfiguration, defaultSiteConfiguration } from "./defaults";
import { parseSiteConfiguration, siteConfigurationEqual } from "./domain";
import {
  clearSiteConfiguration,
  persistSiteConfiguration,
  restoreSiteConfiguration,
} from "./persistence";
import {
  SITE_CONFIG_STORAGE_KEY,
  type SiteConfiguration,
  type SiteConfigStatus,
} from "./types";

interface Value {
  content: SiteConfiguration;
  enabled: boolean;
  hydrated: boolean;
  dirty: boolean;
  status: SiteConfigStatus;
  update(operation: (current: SiteConfiguration) => SiteConfiguration): void;
  save(): boolean;
  reset(): void;
  restoreDefaults(): boolean;
}
const disabled: Value = {
  content: defaultSiteConfiguration,
  enabled: false,
  hydrated: true,
  dirty: false,
  status: "disabled",
  update: () => undefined,
  save: () => false,
  reset: () => undefined,
  restoreDefaults: () => false,
};
const Context = createContext<Value>(disabled);
const storage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};
export function SiteConfigProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const [content, setContent] = useState(defaultSiteConfiguration);
  const [saved, setSaved] = useState(defaultSiteConfiguration);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<SiteConfigStatus>(
    enabled ? "pending" : "disabled",
  );
  useEffect(() => {
    queueMicrotask(() => {
      if (!enabled) {
        setHydrated(true);
        setStatus("disabled");
        return;
      }
      const restored = restoreSiteConfiguration(storage());
      const initial = restored.content ?? cloneSiteConfiguration();
      setContent(initial);
      setSaved(initial);
      setStatus(
        restored.status === "invalid"
          ? "recovered"
          : restored.status === "unavailable"
            ? "unavailable"
            : "ready",
      );
      setHydrated(true);
    });
  }, [enabled]);
  useEffect(() => {
    if (!enabled || !hydrated) return;
    const sync = (event: StorageEvent) => {
      if (event.key !== SITE_CONFIG_STORAGE_KEY) return;
      const restored = restoreSiteConfiguration(storage());
      const next = restored.content ?? cloneSiteConfiguration();
      setContent(next);
      setSaved(next);
      setStatus("ready");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [enabled, hydrated]);
  const dirty = !siteConfigurationEqual(content, saved);
  useEffect(() => {
    if (!enabled || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, enabled]);
  const update = useCallback(
    (operation: (current: SiteConfiguration) => SiteConfiguration) => {
      if (enabled) setContent((current) => operation(structuredClone(current)));
    },
    [enabled],
  );
  const value = useMemo<Value>(
    () => ({
      content,
      enabled,
      hydrated,
      dirty,
      status,
      update,
      save: () => {
        const validated = enabled ? parseSiteConfiguration(content) : null;
        if (!validated) return false;
        const success = persistSiteConfiguration(storage(), validated);
        if (success) {
          setContent(validated);
          setSaved(validated);
          setStatus("saved");
        } else setStatus("unavailable");
        return success;
      },
      reset: () => setContent(cloneSiteConfiguration()),
      restoreDefaults: () => {
        if (!enabled) return false;
        const next = cloneSiteConfiguration();
        const success = clearSiteConfiguration(storage());
        setContent(next);
        setSaved(next);
        setStatus(success ? "saved" : "unavailable");
        return success;
      },
    }),
    [content, dirty, enabled, hydrated, status, update],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useSiteConfig = () => useContext(Context);
