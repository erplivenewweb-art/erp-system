import type { Metadata } from "next";
import { ProductCMSManager } from "@/features/product-cms-simulation";
export const metadata: Metadata = {
  title: "Development product CMS simulation",
  description: "Browser-only product, category and collection manager.",
  robots: { index: false, follow: false, nocache: true },
};
export default function Page() {
  return <ProductCMSManager />;
}
