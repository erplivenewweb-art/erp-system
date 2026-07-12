import type { Metadata } from "next";
import { Dashboard } from "@/features/account";
export const metadata: Metadata = { title: "Customer account preview", description: "Static customer dashboard without authentication or account data.", alternates: { canonical: "/account" }, robots: { index: false, follow: false } };
export default function Page() { return <Dashboard />; }
