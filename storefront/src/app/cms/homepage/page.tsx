import type { Metadata } from "next";
import { HomepageManager } from "@/features/cms";

export const metadata: Metadata = {
  title: "Development homepage CMS simulation",
  description: "Browser-only homepage content editor.",
  alternates: { canonical: "/cms/homepage" },
  robots: { index: false, follow: false, nocache: true },
};

export default function Page() {
  return <HomepageManager />;
}
