"use client";

import Link, { type LinkProps } from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { classNames } from "@/lib/class-names";
import { VisuallyHidden } from "@/components/layout";
import styles from "./Actions.module.css";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: ButtonVariant;
}

export function Button({ children, className, disabled, loading = false, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      aria-busy={loading || undefined}
      className={classNames(styles.button, styles[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  pressed?: boolean;
}

export function IconButton({ children, className, label, pressed, ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className={classNames(styles.iconButton, className)}
      type="button"
      {...props}
    >
      {children}
      <VisuallyHidden>{label}</VisuallyHidden>
    </button>
  );
}

export interface LinkButtonProps extends LinkProps {
  children: ReactNode;
  className?: string;
  external?: boolean;
  variant?: ButtonVariant;
}

export function LinkButton({ children, className, external = false, variant = "primary", ...props }: LinkButtonProps) {
  return (
    <Link
      className={classNames(styles.button, styles[variant], className)}
      rel={external ? "noopener noreferrer" : undefined}
      target={external ? "_blank" : undefined}
      {...props}
    >
      {children}
    </Link>
  );
}

