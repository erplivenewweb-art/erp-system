import type { Metadata } from "next";
import { Showcase } from "./Showcase";

export const metadata: Metadata = {
  title: "Design System · Storefront Scaffold",
  description: "Development-only shared UI foundation showcase.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function DesignSystemPage() {
  return <Showcase />;
}

