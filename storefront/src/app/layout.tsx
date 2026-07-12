import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PublicFooter, PublicHeader } from "@/components/public-shell";
import "@/styles/globals.css";
import styles from "./shell.module.css";

export const metadata: Metadata = {
  title: { default: "Silver Sankha", template: "%s | Silver Sankha" },
  description: "Manufacturer-led Silver Sankha and Pola jewellery, presented with clear product information and considered craftsmanship.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Silver Sankha Jewellery House",
    description: "A manufacturer-led home for Silver Sankha and Pola jewellery.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Silver Sankha Jewellery House",
    description: "A manufacturer-led home for Silver Sankha and Pola jewellery.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en" data-theme="light"><body><a className={styles.skipLink} href="#main-content">Skip to main content</a><PublicHeader /><main className={styles.main} id="main-content">{children}</main><PublicFooter /></body></html>;
}
