import type { Metadata } from "next";
import { SiteConfigManager } from "@/features/site-config-simulation";
export const metadata: Metadata = {
  title: "Navigation manager preview",
  description: "Static menu manager.",
  robots: { index: false, follow: false, nocache: true },
};
export default function Page() {
  return <SiteConfigManager section="navigation" />;
}
