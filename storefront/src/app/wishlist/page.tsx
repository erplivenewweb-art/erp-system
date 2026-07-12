import type { Metadata } from "next";
import { WishlistPage } from "@/features/wishlist";
export const metadata: Metadata = { title: "Wishlist preview", description: "Static saved-piece presentation without account persistence.", alternates: { canonical: "/wishlist" }, robots: { index: false, follow: true } };
export default function Page() { return <WishlistPage />; }
