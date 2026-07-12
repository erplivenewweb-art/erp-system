import type { ReactNode, SVGProps } from "react";

export type IconName = "account" | "cart" | "check" | "chevron" | "close" | "facebook" | "heart" | "instagram" | "menu" | "minus" | "pinterest" | "plus" | "search" | "star" | "warning" | "whatsapp" | "youtube";

const paths: Record<IconName, ReactNode> = {
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  cart: <><path d="M3 4h2l2.2 10h9.9l2-7H6" /><circle cx="9" cy="19" r="1" /><circle cx="17" cy="19" r="1" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  facebook: <path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v5h4v-5h3l1-4h-4V9c0-.7.3-1 1-1Z" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z" />,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  minus: <path d="M5 12h14" />,
  pinterest: <><circle cx="12" cy="12" r="9" /><path d="M9 19c1-3 1-5 2-8-.4-2 .5-4 2-4 1.3 0 2 1 2 2.3 0 2-1 4-2.7 4-1 0-1.6-.8-1.3-1.8" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  warning: <path d="M12 4 3 20h18L12 4Zm0 5v5m0 3h.01" />,
  whatsapp: <><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z" /><path d="M9 8c.5 3 2 4.5 5 5l1-1" /></>,
  youtube: <><path d="M21 12c0 4-1 6-3 6H6c-2 0-3-2-3-6s1-6 3-6h12c2 0 3 2 3 6Z" /><path d="m10 9 5 3-5 3Z" /></>,
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> { name: IconName; label?: string; size?: 16 | 20 | 24 | 32; }

export function Icon({ name, label, size = 20, ...props }: IconProps) {
  return <svg aria-hidden={label ? undefined : true} aria-label={label} fill="none" height={size} role={label ? "img" : undefined} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width={size} {...props}>{paths[name]}</svg>;
}
