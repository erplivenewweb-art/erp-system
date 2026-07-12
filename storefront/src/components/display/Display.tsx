import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "@/components/icons";
import { classNames } from "@/lib/class-names";
import styles from "./Display.module.css";

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <article className={classNames(styles.card, className)} {...props} />;
}
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" }) {
  return <span className={classNames(styles.badge, styles[tone])}>{children}</span>;
}
export function StatusChip({ children, status = "info" }: { children: ReactNode; status?: "success" | "warning" | "danger" | "info" }) {
  return <span className={classNames(styles.status, styles[status])}><span aria-hidden="true" className={styles.dot} />{children}</span>;
}
export function PriceBlock({ amount, currency = "INR", note }: { amount: string; currency?: string; note?: string }) {
  return <div className={styles.price}><span><span className={styles.currency}>{currency}</span> {amount}</span>{note ? <small>{note}</small> : null}</div>;
}
export function AvailabilityIndicator({ label, status = "info" }: { label: string; status?: "success" | "warning" | "danger" | "info" }) {
  return <StatusChip status={status}>{label}</StatusChip>;
}
export function AvatarPlaceholder({ label }: { label: string }) {
  const initials = label.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span aria-label={label} className={styles.avatar} role="img">{initials}</span>;
}
export function Rating({ value, count }: { value: number; count?: number }) {
  const safe = Math.max(0, Math.min(5, value));
  return <span aria-label={`${safe} out of 5 stars`} className={styles.rating}><Icon name="star" size={20} /><span>{safe.toFixed(1)}{count === undefined ? "" : ` (${count})`}</span></span>;
}

