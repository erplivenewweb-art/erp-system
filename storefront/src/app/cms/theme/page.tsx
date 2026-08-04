import type { Metadata } from "next";
import { ThemeManager } from "@/features/admin";
export const metadata: Metadata = {
  title: "Theme manager preview",
  description: "Static theme controls.",
  robots: { index: false, follow: false, nocache: true },
};
export default function Page() {
  return <ThemeManager />;
}
