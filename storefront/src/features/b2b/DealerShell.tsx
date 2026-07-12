import Link from "next/link";
import { Container, Section } from "@/components/layout";
import { dealerNavigation } from "./data";
import styles from "./B2B.module.css";
export function DealerNavigation() { return <nav aria-label="Dealer portal"><h2>Wholesale portal</h2><ul>{dealerNavigation.map(([href, label]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul><button type="button">Logout placeholder</button></nav>; }
export function DealerShell({ children }: { children: React.ReactNode }) { return <Section><Container><div className={styles.shell}><aside className={styles.nav}><DealerNavigation /></aside><div className={styles.content}>{children}</div></div></Container></Section>; }
export function DealerHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <header className={styles.header}><span className={styles.eyebrow}>{eyebrow}</span><h1>{title}</h1><p className={styles.lede}>{description}</p></header>; }
