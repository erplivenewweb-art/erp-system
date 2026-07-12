import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PublicFooter, PublicHeader } from "@/components/public-shell";
import "@/styles/globals.css";
import styles from "./shell.module.css";

export const metadata: Metadata = {
  title: { default: "Silver Sankha", template: "%s | Silver Sankha" },
  description: "Public storefront shell for Silver Sankha Jewellery House.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en" data-theme="light"><body><a className={styles.skipLink} href="#main-content">Skip to main content</a><PublicHeader /><main className={styles.main} id="main-content">{children}</main><PublicFooter /></body></html>;
}
