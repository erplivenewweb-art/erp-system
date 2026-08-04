import type { Metadata } from "next";
import { SiteConfigManager } from "@/features/site-config-simulation";
export const metadata: Metadata = {
  title: "Announcement CMS preview",
  description: "Browser-local announcement configuration.",
  robots: { index: false, follow: false, nocache: true },
};
export default function Page() {
  return <SiteConfigManager section="announcement" />;
}
