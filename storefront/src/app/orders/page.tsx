import type { Metadata } from "next";
import { Container, Section } from "@/components/layout";
import { NoOrders } from "@/features/checkout";
export const metadata: Metadata = { title: "Order history preview", description: "Static empty order-history state.", robots: { index: false, follow: false } };
export default function Page() { return <Section><Container><NoOrders /></Container></Section>; }
