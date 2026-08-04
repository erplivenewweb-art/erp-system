import type { Metadata } from "next";
import { CategoryManager } from "@/features/admin";
export const metadata: Metadata = {
  title: "Category CMS preview",
  description: "Static category manager.",
  robots: { index: false, follow: false, nocache: true },
};
export default function Page() {
  return <CategoryManager />;
}
