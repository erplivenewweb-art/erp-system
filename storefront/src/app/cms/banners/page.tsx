import type { Metadata } from "next";
import { BannerManager } from "@/features/admin";
export const metadata: Metadata = {
  title: "Banner manager preview",
  description: "Static banner manager.",
  robots: { index: false, follow: false, nocache: true },
};
export default function Page() {
  return <BannerManager />;
}
