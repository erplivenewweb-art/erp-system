import type { Metadata } from "next";
import { CMSDashboard } from "@/features/cms";

export const metadata: Metadata = {
  title: "Development CMS simulation",
  description: "Browser-only homepage and marketing content editor.",
  alternates: { canonical: "/cms" },
  robots: { index: false, follow: false, nocache: true },
};

export default function Page() {
  return <CMSDashboard />;
}
