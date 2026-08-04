import type { Metadata } from "next";
import { MediaLibraryManager } from "@/features/media-cms-simulation/MediaLibraryManager";
export const metadata: Metadata = {
  title: "Media library preview",
  description: "Static asset library without uploads.",
  robots: { index: false, follow: false, nocache: true },
};
export default function Page() {
  return <MediaLibraryManager />;
}
