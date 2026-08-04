import type { Metadata } from "next";
import { SectionsManager } from "@/features/admin";
export const metadata: Metadata = {
  title: "Homepage sections preview",
  description: "Static section composition manager.",
  robots: { index: false, follow: false, nocache: true },
};
export default function Page() {
  return <SectionsManager />;
}
