import type { Metadata } from "next";
import { PreviewHub } from "@/features/admin";
export const metadata: Metadata = {
  title: "Content previews",
  description: "Static preview hub.",
  robots: { index: false, follow: false, nocache: true },
};
export default function Page() {
  return <PreviewHub />;
}
