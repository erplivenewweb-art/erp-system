import type { Metadata } from "next";
import { SiteConfigManager } from "@/features/site-config-simulation";
export const metadata: Metadata = {
  title: "Footer manager preview",
  description: "Static footer content manager.",
  robots: { index: false, follow: false, nocache: true },
};
export default function Page() {
  return <SiteConfigManager section="footer" />;
}
