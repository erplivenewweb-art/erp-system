"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import styles from "./Navigation.module.css";

export interface BreadcrumbItem { href?: string; label: string; }
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return <nav aria-label="Breadcrumb"><ol className={styles.breadcrumb}>{items.map((item, index) => <li key={item.label}>{index ? <span aria-hidden="true">/</span> : null}{item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li>)}</ol></nav>;
}

export interface TabItem { id: string; label: string; panel: ReactNode; }
export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  const [selected, setSelected] = useState(items[0]?.id);
  const base = useId();
  function keyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    setSelected(items[next].id);
    document.getElementById(base + "-tab-" + items[next].id)?.focus();
  }
  return <div><div aria-label={label} className={styles.tabs} role="tablist">{items.map((item, index) => <button aria-controls={base + "-panel-" + item.id} aria-selected={selected === item.id} id={base + "-tab-" + item.id} key={item.id} onClick={() => setSelected(item.id)} onKeyDown={(event) => keyDown(event, index)} role="tab" tabIndex={selected === item.id ? 0 : -1} type="button">{item.label}</button>)}</div>{items.map((item) => <div aria-labelledby={base + "-tab-" + item.id} hidden={selected !== item.id} id={base + "-panel-" + item.id} key={item.id} role="tabpanel" tabIndex={0}>{item.panel}</div>)}</div>;
}

export function Accordion({ items }: { items: Array<{ id: string; title: string; content: ReactNode }> }) {
  return <div className={styles.accordion}>{items.map((item) => <details key={item.id}><summary>{item.title}<Icon name="chevron" /></summary><div className={styles.accordionPanel}>{item.content}</div></details>)}</div>;
}

