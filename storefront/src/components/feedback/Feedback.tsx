import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { Button, LinkButton } from "@/components/ui";
import { classNames } from "@/lib/class-names";
import styles from "./Feedback.module.css";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return <span aria-label={label} className={styles.spinner} role="status" />;
}
export function Skeleton({ label = "Loading content" }: { label?: string }) {
  return <span aria-label={label} className={styles.skeleton} role="status" />;
}
export function Alert({ children, title, tone = "info" }: { children: ReactNode; title: string; tone?: "info" | "success" | "warning" | "danger" }) {
  return <div className={classNames(styles.alert, styles[tone])} role={tone === "danger" ? "alert" : "status"}><Icon name={tone === "danger" || tone === "warning" ? "warning" : "check"} /><div><strong>{title}</strong><div>{children}</div></div></div>;
}
export function InlineMessage({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "warning" | "danger" }) {
  return <p className={classNames(styles.inlineMessage, styles[tone])} role={tone === "danger" ? "alert" : "status"}>{children}</p>;
}
interface StateProps { actionHref?: string; actionLabel?: string; description: string; onRetry?: () => void; title: string; }
export function EmptyState({ actionHref, actionLabel, description, title }: StateProps) {
  return <section className={styles.state}><h3>{title}</h3><p>{description}</p>{actionHref && actionLabel ? <LinkButton href={actionHref}>{actionLabel}</LinkButton> : null}</section>;
}
export function ErrorState({ description, onRetry, title }: StateProps) {
  return <section className={styles.state} role="alert"><h3>{title}</h3><p>{description}</p>{onRetry ? <Button onClick={onRetry}>Try again</Button> : null}</section>;
}
export function LoadingState({ description = "Please wait.", title = "Loading" }: Partial<StateProps>) {
  return <section className={styles.state} aria-busy="true" aria-live="polite"><Spinner /><h3>{title}</h3><p>{description}</p></section>;
}

