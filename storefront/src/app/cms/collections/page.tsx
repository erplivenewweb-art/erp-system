import type { Metadata } from "next";
import { CollectionManager } from "@/features/admin";
export const metadata: Metadata = {
  title: "Collection CMS preview",
  description: "Static collection manager.",
  robots: { index: false, follow: false, nocache: true },
};
export default function Page() {
  return <CollectionManager />;
}
