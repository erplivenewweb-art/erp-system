"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/icons";
import {
  type NavigationItem,
  primaryNavigation,
  secondaryNavigation,
} from "@/config/public-navigation";
import { AccountNavigationAction } from "@/features/customer-account-simulation";
import { IntentNavigationActions } from "@/features/customer-intent";
import { useCMSContent } from "@/features/cms";
import {
  orderedVisibleNavigation,
  useSiteConfig,
} from "@/features/site-config-simulation";
import styles from "./PublicShell.module.css";

const actionLinks = [
  {
    href: "/products#catalogue-search",
    icon: "search" as const,
    label: "Search",
  },
];

export function PublicHeader() {
  const cms = useCMSContent();
  const site = useSiteConfig();
  const configuredPrimary: readonly NavigationItem[] = site.enabled
    ? orderedVisibleNavigation(site.content, "PRIMARY").map((item) => ({
        href: item.url,
        label: item.label,
        openInNewTab: item.openInNewTab,
        children: primaryNavigation.find((entry) => entry.label === item.label)
          ?.children,
      }))
    : primaryNavigation;
  const configuredSecondary: readonly NavigationItem[] = site.enabled
    ? orderedVisibleNavigation(site.content, "SECONDARY").map((item) => ({
        href: item.url,
        label: item.label,
        openInNewTab: item.openInNewTab,
      }))
    : secondaryNavigation;
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    if (open && !drawer.open) {
      drawer.showModal();
      drawer.querySelector<HTMLElement>("button, a")?.focus();
    } else if (!open && drawer.open) {
      drawer.close();
    }
  }, [open]);

  function closeDrawer() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href]",
      ),
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <header className={styles.header} data-testid="public-header">
      {(
        site.enabled
          ? site.content.announcement.visible
          : cms.content.marketing.announcement.enabled
      ) ? (
        <div
          className={styles.utilityBar}
          data-preset={
            site.enabled
              ? site.content.announcement.backgroundToken === "brand-silver"
                ? "silver"
                : site.content.announcement.backgroundToken ===
                    "brand-vermilion"
                  ? "vermilion"
                  : "ink"
              : cms.content.marketing.announcement.colorPreset
          }
        >
          {site.enabled && site.content.announcement.festivalBadge ? (
            <strong>{site.content.announcement.festivalBadge}</strong>
          ) : null}
          <span>
            {site.enabled
              ? site.content.announcement.message
              : cms.content.marketing.announcement.text}
          </span>
          <Link
            href={site.enabled ? site.content.announcement.ctaUrl : "/products"}
          >
            {site.enabled
              ? site.content.announcement.ctaLabel
              : cms.content.marketing.announcement.ctaLabel}
          </Link>
        </div>
      ) : null}
      <div className={styles.headerMain}>
        <button
          aria-controls={drawerId}
          aria-expanded={open}
          aria-label="Open menu"
          className={styles.menuButton}
          onClick={() => setOpen(true)}
          ref={triggerRef}
          type="button"
        >
          <Icon name="menu" />
          <span>Menu</span>
        </button>
        <Link aria-label="Silver Sankha home" className={styles.logo} href="/">
          <span className={styles.logoMark} aria-hidden="true">
            SS
          </span>
          <span>
            <strong>{site.content.header.logoText}</strong>
            <small>{site.content.header.logoSubtitle}</small>
          </span>
        </Link>
        <nav aria-label="Primary" className={styles.desktopNav}>
          <ul>
            {configuredPrimary.map((item) => (
              <li key={item.label}>
                {item.children ? (
                  <details>
                    <summary>
                      {item.label}
                      <Icon name="chevron" size={16} />
                    </summary>
                    <div className={styles.megaMenu}>
                      <Link href={item.href}>Explore {item.label}</Link>
                      {item.children.map((child) => (
                        <Link href={child.href} key={child.label}>
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </details>
                ) : (
                  <Link
                    href={item.href}
                    target={item.openInNewTab ? "_blank" : undefined}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.actions} aria-label="Storefront actions">
          {actionLinks.map((action) => (
            <Link
              aria-label={action.label}
              href={action.href}
              key={action.label}
            >
              <Icon name={action.icon} />
              <span>{action.label}</span>
            </Link>
          ))}
          <AccountNavigationAction />
          <IntentNavigationActions />
          <Link className={styles.wholesaleAction} href="/wholesale">
            Wholesale
          </Link>
        </div>
      </div>
      <nav aria-label="More" className={styles.secondaryNav}>
        <ul>
          {configuredSecondary.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                target={item.openInNewTab ? "_blank" : undefined}
              >
                {item.label}
                {"future" in item && item.future ? (
                  <span className={styles.future}>Soon</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <dialog
        aria-labelledby={drawerId + "-title"}
        className={styles.mobileDrawer}
        id={drawerId}
        onCancel={closeDrawer}
        onClose={() => triggerRef.current?.focus()}
        onKeyDown={trapFocus}
        ref={drawerRef}
      >
        <div className={styles.drawerHeading}>
          <h2 id={drawerId + "-title"}>Explore Silver Sankha</h2>
          <button aria-label="Close menu" onClick={closeDrawer} type="button">
            <Icon name="close" />
          </button>
        </div>
        <nav aria-label="Mobile">
          <ul className={styles.mobileLinks}>
            {[...configuredPrimary, ...configuredSecondary].map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={closeDrawer}
                  target={item.openInNewTab ? "_blank" : undefined}
                >
                  {item.label}
                  {"future" in item && item.future ? <span>Future</span> : null}
                </Link>
                {item.children ? (
                  <ul>
                    {item.children.map((child) => (
                      <li key={child.label}>
                        <Link href={child.href} onClick={closeDrawer}>
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.drawerActions}>
          {actionLinks.map((action) => (
            <Link href={action.href} key={action.label} onClick={closeDrawer}>
              <Icon name={action.icon} />
              {action.label}
            </Link>
          ))}
          <AccountNavigationAction mobile onNavigate={closeDrawer} />
          <IntentNavigationActions mobile onNavigate={closeDrawer} />
        </div>
      </dialog>
    </header>
  );
}
