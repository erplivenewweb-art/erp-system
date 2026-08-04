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
import { cloneCMSContent, defaultCMSContent } from "./defaults";
import {
  contentEqual,
  parseCMSContent,
  resetHomepage,
  resetMarketing,
} from "./domain";
import {
  clearCMSContent,
  persistCMSContent,
  restoreCMSContent,
} from "./persistence";
import {
  CMS_STORAGE_KEY,
  type CMSContent,
  type CMSHomepageContent,
  type CMSMarketingContent,
  type CMSPersistenceStatus,
} from "./types";

interface CMSContextValue {
  content: CMSContent;
  dirty: boolean;
  enabled: boolean;
  hydrated: boolean;
  persistenceStatus: CMSPersistenceStatus;
  updateHero(value: Partial<CMSHomepageContent["hero"]>): void;
  updateSections(value: Partial<CMSHomepageContent["sections"]>): void;
  updateAnnouncement(value: Partial<CMSMarketingContent["announcement"]>): void;
  updateMarketing(
    value: Partial<
      Omit<
        CMSMarketingContent,
        "announcement" | "wholesale" | "seasonalCampaign" | "footer"
      >
    >,
  ): void;
  updateWholesale(value: Partial<CMSMarketingContent["wholesale"]>): void;
  updateSeasonal(value: Partial<CMSMarketingContent["seasonalCampaign"]>): void;
  updateFooter(value: Partial<CMSMarketingContent["footer"]>): void;
  save(): boolean;
  resetHomepage(): void;
  resetMarketing(): void;
  resetEverything(): void;
  restoreDefaults(): boolean;
}

const disabled: CMSContextValue = {
  content: defaultCMSContent,
  dirty: false,
  enabled: false,
  hydrated: true,
  persistenceStatus: "disabled",
  updateHero: () => undefined,
  updateSections: () => undefined,
  updateAnnouncement: () => undefined,
  updateMarketing: () => undefined,
  updateWholesale: () => undefined,
  updateSeasonal: () => undefined,
  updateFooter: () => undefined,
  save: () => false,
  resetHomepage: () => undefined,
  resetMarketing: () => undefined,
  resetEverything: () => undefined,
  restoreDefaults: () => false,
};

const CMSContext = createContext<CMSContextValue>(disabled);

export function CMSContentProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const [content, setContent] = useState<CMSContent>(defaultCMSContent);
  const [saved, setSaved] = useState<CMSContent>(defaultCMSContent);
  const [hydrated, setHydrated] = useState(false);
  const [persistenceStatus, setPersistenceStatus] =
    useState<CMSPersistenceStatus>(enabled ? "pending" : "disabled");

  useEffect(() => {
    queueMicrotask(() => {
      if (!enabled) {
        setHydrated(true);
        setPersistenceStatus("disabled");
        return;
      }
      const restored = restoreCMSContent(browserStorage());
      const initial = restored.content ?? cloneCMSContent();
      setContent(initial);
      setSaved(initial);
      setPersistenceStatus(
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
    function sync(event: StorageEvent) {
      if (event.key !== CMS_STORAGE_KEY) return;
      const restored = restoreCMSContent(browserStorage());
      if (restored.content) {
        setContent(restored.content);
        setSaved(restored.content);
        setPersistenceStatus("ready");
      } else if (event.newValue === null) {
        const defaults = cloneCMSContent();
        setContent(defaults);
        setSaved(defaults);
      }
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [enabled, hydrated]);

  const dirty = !contentEqual(content, saved);
  useEffect(() => {
    if (!enabled || !dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, enabled]);

  const mutate = useCallback(
    (operation: (current: CMSContent) => CMSContent) => {
      if (enabled) setContent(operation);
    },
    [enabled],
  );

  const value = useMemo<CMSContextValue>(
    () => ({
      content,
      dirty,
      enabled,
      hydrated,
      persistenceStatus,
      updateHero: (next) =>
        mutate((current) => ({
          ...current,
          homepage: {
            ...current.homepage,
            hero: { ...current.homepage.hero, ...next },
          },
        })),
      updateSections: (next) =>
        mutate((current) => ({
          ...current,
          homepage: {
            ...current.homepage,
            sections: { ...current.homepage.sections, ...next },
          },
        })),
      updateAnnouncement: (next) =>
        mutate((current) => ({
          ...current,
          marketing: {
            ...current.marketing,
            announcement: { ...current.marketing.announcement, ...next },
          },
        })),
      updateMarketing: (next) =>
        mutate((current) => ({
          ...current,
          marketing: { ...current.marketing, ...next },
        })),
      updateWholesale: (next) =>
        mutate((current) => ({
          ...current,
          marketing: {
            ...current.marketing,
            wholesale: { ...current.marketing.wholesale, ...next },
          },
        })),
      updateSeasonal: (next) =>
        mutate((current) => ({
          ...current,
          marketing: {
            ...current.marketing,
            seasonalCampaign: {
              ...current.marketing.seasonalCampaign,
              ...next,
            },
          },
        })),
      updateFooter: (next) =>
        mutate((current) => ({
          ...current,
          marketing: {
            ...current.marketing,
            footer: { ...current.marketing.footer, ...next },
          },
        })),
      save: () => {
        if (!enabled) return false;
        const validated = parseCMSContent(content);
        if (!validated) return false;
        const success = persistCMSContent(browserStorage(), validated);
        if (success) {
          setContent(validated);
          setSaved(validated);
          setPersistenceStatus("saved");
        } else setPersistenceStatus("unavailable");
        return success;
      },
      resetHomepage: () => mutate(resetHomepage),
      resetMarketing: () => mutate(resetMarketing),
      resetEverything: () => mutate(() => cloneCMSContent()),
      restoreDefaults: () => {
        if (!enabled) return false;
        const defaults = cloneCMSContent();
        const success = clearCMSContent(browserStorage());
        setContent(defaults);
        setSaved(defaults);
        setPersistenceStatus(success ? "saved" : "unavailable");
        return success;
      },
    }),
    [content, dirty, enabled, hydrated, mutate, persistenceStatus],
  );

  return <CMSContext.Provider value={value}>{children}</CMSContext.Provider>;
}

export function useCMSContent() {
  return useContext(CMSContext);
}

function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
