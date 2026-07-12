import type { Metadata } from "next";
import { SecurityPage } from "@/features/security";
export const metadata: Metadata = { title: "Account security preview", description: "Static password, two-factor, session and privacy UI.", alternates: { canonical: "/account/security" }, robots: { index: false, follow: false } };
export default function Page() { return <SecurityPage />; }
