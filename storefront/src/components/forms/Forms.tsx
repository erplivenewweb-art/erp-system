import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { classNames } from "@/lib/class-names";
import styles from "./Forms.module.css";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={classNames(styles.label, className)} {...props} />;
}

export function HelpText({ children, id }: { children: ReactNode; id?: string }) {
  return <p className={styles.help} id={id}>{children}</p>;
}

export function ValidationMessage({ children, id, status = "error" }: { children: ReactNode; id?: string; status?: "error" | "success" }) {
  return <p className={classNames(styles.validation, styles[status])} id={id} role={status === "error" ? "alert" : "status"}>{children}</p>;
}

export function Field({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={classNames(styles.field, className)}>{children}</div>;
}

export function Input({ className, invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={classNames(styles.control, invalid && styles.invalid, className)} {...props} />;
}

export function Textarea({ className, invalid, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea aria-invalid={invalid || undefined} className={classNames(styles.control, styles.textarea, invalid && styles.invalid, className)} {...props} />;
}

export function Select({ children, className, invalid, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return <select aria-invalid={invalid || undefined} className={classNames(styles.control, invalid && styles.invalid, className)} {...props}>{children}</select>;
}

interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  children: ReactNode;
}

export function Checkbox({ children, className, ...props }: ChoiceProps) {
  return <label className={classNames(styles.choice, className)}><input type="checkbox" {...props} /><span>{children}</span></label>;
}

export function Radio({ children, className, ...props }: ChoiceProps) {
  return <label className={classNames(styles.choice, className)}><input type="radio" {...props} /><span>{children}</span></label>;
}

export function Switch({ children, className, ...props }: ChoiceProps) {
  return (
    <label className={classNames(styles.switch, className)}>
      <input role="switch" type="checkbox" {...props} />
      <span className={styles.track} aria-hidden="true"><span /></span>
      <span>{children}</span>
    </label>
  );
}

