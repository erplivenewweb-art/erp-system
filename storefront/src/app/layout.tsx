import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PublicFooter, PublicHeader } from "@/components/public-shell";
import { CMSContentProvider } from "@/features/cms";
import { CustomerAccountProvider } from "@/features/customer-account-simulation";
import { CartDrawer, CustomerIntentProvider } from "@/features/customer-intent";
import { DiscoveryProvider } from "@/features/discovery-simulation";
import { RuntimeStatusBanner } from "@/features/integration-runtime";
import { MediaCMSProvider } from "@/features/media-cms-simulation/MediaCMSProvider";
import { ProductCMSProvider } from "@/features/product-cms-simulation";
import { SiteConfigProvider } from "@/features/site-config-simulation";
import "@/styles/globals.css";
import styles from "./shell.module.css";

export const metadata: Metadata = {
  title: { default: "Silver Sankha", template: "%s | Silver Sankha" },
  description:
    "Manufacturer-led Silver Sankha and Pola jewellery, presented with clear product information and considered craftsmanship.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Silver Sankha Jewellery House",
    description:
      "A manufacturer-led home for Silver Sankha and Pola jewellery.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Silver Sankha Jewellery House",
    description:
      "A manufacturer-led home for Silver Sankha and Pola jewellery.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const showRuntimeStatus =
    process.env.NODE_ENV === "development" &&
    process.env.STOREFRONT_RUNTIME_STATUS_ENABLED === "true";
  return (
    <html lang="en" data-theme="light">
      <body>
        <CMSContentProvider enabled={process.env.NODE_ENV === "development"}>
          <ProductCMSProvider enabled={process.env.NODE_ENV === "development"}>
            <SiteConfigProvider
              enabled={process.env.NODE_ENV === "development"}
            >
              <DiscoveryProvider
                enabled={process.env.NODE_ENV === "development"}
              >
                <MediaCMSProvider
                  enabled={process.env.NODE_ENV === "development"}
                >
                  <CustomerIntentProvider
                    enabled={process.env.NODE_ENV === "development"}
                  >
                    <CustomerAccountProvider
                      enabled={process.env.NODE_ENV === "development"}
                    >
                      <a className={styles.skipLink} href="#main-content">
                        Skip to main content
                      </a>
                      {showRuntimeStatus ? <RuntimeStatusBanner /> : null}
                      <PublicHeader />
                      <CartDrawer />
                      <main className={styles.main} id="main-content">
                        {children}
                      </main>
                      <PublicFooter />
                    </CustomerAccountProvider>
                  </CustomerIntentProvider>
                </MediaCMSProvider>
              </DiscoveryProvider>
            </SiteConfigProvider>
          </ProductCMSProvider>
        </CMSContentProvider>
      </body>
    </html>
  );
}
