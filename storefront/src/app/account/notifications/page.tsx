import type { Metadata } from "next";
import { NotificationsPage } from "@/features/account";
export const metadata: Metadata = { title: "Account notifications preview", description: "Static notification list and settings UI.", alternates: { canonical: "/account/notifications" }, robots: { index: false, follow: false } };
export default function Page() { return <NotificationsPage />; }
