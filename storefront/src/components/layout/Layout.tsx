import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "@/lib/class-names";
import styles from "./Layout.module.css";

type Space = "none" | "xs" | "sm" | "md" | "lg" | "xl";

interface BaseProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

export function Container({ className, children, ...props }: BaseProps) {
  return <div className={classNames(styles.container, className)} {...props}>{children}</div>;
}

export function Section({ className, children, ...props }: BaseProps) {
  return <section className={classNames(styles.section, className)} {...props}>{children}</section>;
}

export function Stack({ className, children, gap = "md", ...props }: BaseProps & { gap?: Space }) {
  return <div className={classNames(styles.stack, styles[`gap-${gap}`], className)} {...props}>{children}</div>;
}

export function Inline({ className, children, gap = "sm", ...props }: BaseProps & { gap?: Space }) {
  return <div className={classNames(styles.inline, styles[`gap-${gap}`], className)} {...props}>{children}</div>;
}

export function Grid({ className, children, columns = "auto", ...props }: BaseProps & { columns?: "auto" | "two" | "three" | "four" }) {
  return <div className={classNames(styles.grid, styles[`columns-${columns}`], className)} {...props}>{children}</div>;
}

export function Cluster({ className, children, ...props }: BaseProps) {
  return <div className={classNames(styles.cluster, className)} {...props}>{children}</div>;
}

export function Center({ className, children, ...props }: BaseProps) {
  return <div className={classNames(styles.center, className)} {...props}>{children}</div>;
}

export function Surface({ className, children, tone = "raised", ...props }: BaseProps & { tone?: "raised" | "subtle" | "inverse" }) {
  return <div className={classNames(styles.surface, styles[`tone-${tone}`], className)} {...props}>{children}</div>;
}

export function Divider({ className, ...props }: Omit<BaseProps, "children">) {
  return <hr className={classNames(styles.divider, className)} {...props} />;
}

export function VisuallyHidden({ className, children, ...props }: BaseProps) {
  return <span className={classNames(styles.visuallyHidden, className)} {...props}>{children}</span>;
}

