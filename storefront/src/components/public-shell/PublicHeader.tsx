"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/icons";
import { primaryNavigation, secondaryNavigation } from "@/config/public-navigation";
import styles from "./PublicShell.module.css";

const actionLinks = [
  { href: "/search", icon: "search" as const, label: "Search" },
  { href: "/wishlist", icon: "heart" as const, label: "Wishlist" },
  { href: "/cart", icon: "cart" as const, label: "Cart" },
  { href: "/account", icon: "account" as const, label: "Account" },
];

export function PublicHeader() {
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
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]"));
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
      <div className={styles.utilityBar}>
        <span>Manufacturer-led silver jewellery house</span>
        <Link href="/wholesale">Wholesale partnerships</Link>
      </div>
      <div className={styles.headerMain}>
        <button aria-controls={drawerId} aria-expanded={open} aria-label="Open menu" className={styles.menuButton} onClick={() => setOpen(true)} ref={triggerRef} type="button">
          <Icon name="menu" /><span>Menu</span>
        </button>
        <Link aria-label="Silver Sankha home" className={styles.logo} href="/">
          <span className={styles.logoMark} aria-hidden="true">SS</span>
          <span><strong>Silver Sankha</strong><small>Jewellery House</small></span>
        </Link>
        <nav aria-label="Primary" className={styles.desktopNav}>
          <ul>{primaryNavigation.map((item) => <li key={item.label}>{item.children ? <details><summary>{item.label}<Icon name="chevron" size={16} /></summary><div className={styles.megaMenu}><Link href={item.href}>Explore {item.label}</Link>{item.children.map((child) => <Link href={child.href} key={child.label}>{child.label}</Link>)}</div></details> : <Link href={item.href}>{item.label}</Link>}</li>)}</ul>
        </nav>
        <div className={styles.actions} aria-label="Storefront actions">
          {actionLinks.map((action) => <Link aria-label={action.label} href={action.href} key={action.label}><Icon name={action.icon} /><span>{action.label}</span></Link>)}
          <Link className={styles.wholesaleAction} href="/wholesale">Wholesale</Link>
        </div>
      </div>
      <nav aria-label="More" className={styles.secondaryNav}>
        <ul>{secondaryNavigation.map((item) => <li key={item.label}><Link href={item.href}>{item.label}{item.future ? <span className={styles.future}>Soon</span> : null}</Link></li>)}</ul>
      </nav>
      <dialog aria-labelledby={drawerId + "-title"} className={styles.mobileDrawer} id={drawerId} onCancel={closeDrawer} onClose={() => triggerRef.current?.focus()} onKeyDown={trapFocus} ref={drawerRef}>
        <div className={styles.drawerHeading}><h2 id={drawerId + "-title"}>Explore Silver Sankha</h2><button aria-label="Close menu" onClick={closeDrawer} type="button"><Icon name="close" /></button></div>
        <nav aria-label="Mobile">
          <ul className={styles.mobileLinks}>{[...primaryNavigation, ...secondaryNavigation].map((item) => <li key={item.label}><Link href={item.href} onClick={closeDrawer}>{item.label}{item.future ? <span>Future</span> : null}</Link>{item.children ? <ul>{item.children.map((child) => <li key={child.label}><Link href={child.href} onClick={closeDrawer}>{child.label}</Link></li>)}</ul> : null}</li>)}</ul>
        </nav>
        <div className={styles.drawerActions}>{actionLinks.map((action) => <Link href={action.href} key={action.label} onClick={closeDrawer}><Icon name={action.icon} />{action.label}</Link>)}</div>
      </dialog>
    </header>
  );
}
