import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { classNames } from "@/lib/class-names";
import styles from "./Typography.module.css";

export type TypographyVariant =
  | "display" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
  | "lead" | "body" | "small" | "caption" | "overline"
  | "label" | "price" | "muted";

const defaultElements: Record<TypographyVariant, ElementType> = {
  display: "p", h1: "h1", h2: "h2", h3: "h3", h4: "h4", h5: "h5",
  h6: "h6", lead: "p", body: "p", small: "p", caption: "span",
  overline: "span", label: "span", price: "span", muted: "p",
};

export interface TypographyProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children: ReactNode;
  measure?: boolean;
  variant?: TypographyVariant;
}

export function Typography({
  as,
  children,
  className,
  measure = false,
  variant = "body",
  ...props
}: TypographyProps) {
  const Component = as ?? defaultElements[variant];
  return (
    <Component
      className={classNames(styles.base, styles[variant], measure && styles.measure, className)}
      {...props}
    >
      {children}
    </Component>
  );
}

