import type { Metadata } from "next";
import { ProfilePage } from "@/features/profile";
export const metadata: Metadata = { title: "Customer profile preview", description: "Static profile and communication-preference UI.", alternates: { canonical: "/account/profile" }, robots: { index: false, follow: false } };
export default function Page() { return <ProfilePage />; }
