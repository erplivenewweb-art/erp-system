"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/ui";
import { classNames } from "@/lib/class-names";
import styles from "./Overlays.module.css";

interface OverlayProps {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}

function Overlay({ children, description, onClose, open, title, variant }: OverlayProps & { variant: "dialog" | "drawer" }) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) {
      trigger.current = document.activeElement as HTMLElement;
      node.showModal();
      node.querySelector<HTMLElement>("button, [href], input, select, textarea")?.focus();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);
  function closed() {
    onClose();
    trigger.current?.focus();
  }
  return (
    <dialog aria-describedby={description ? variant + "-description" : undefined} aria-labelledby={variant + "-title"} className={classNames(styles.overlay, styles[variant])} onCancel={closed} onClose={() => trigger.current?.focus()} ref={ref}>
      <div className={styles.heading}><h2 id={variant + "-title"}>{title}</h2><IconButton label={"Close " + title} onClick={closed}><Icon name="close" /></IconButton></div>
      {description ? <p id={variant + "-description"}>{description}</p> : null}
      <div>{children}</div>
    </dialog>
  );
}

export function Modal(props: OverlayProps) { return <Overlay {...props} variant="dialog" />; }
export function Drawer(props: OverlayProps) { return <Overlay {...props} variant="drawer" />; }

export function Toast({ children, onDismiss, tone = "info" }: { children: ReactNode; onDismiss?: () => void; tone?: "info" | "success" | "danger" }) {
  return <div className={classNames(styles.toast, styles[tone])} role={tone === "danger" ? "alert" : "status"}><div>{children}</div>{onDismiss ? <IconButton label="Dismiss notification" onClick={onDismiss}><Icon name="close" size={16} /></IconButton> : null}</div>;
}

