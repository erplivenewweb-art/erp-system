import Link from "next/link";
import { Container, Section } from "@/components/layout";
import { accountNavigation } from "./data";
import styles from "./Account.module.css";

export function AccountNavigation() { return <nav aria-label="Account"><h2>My account</h2><ul>{accountNavigation.map((item) => <li key={item.href}><Link href={item.href}>{item.label}</Link></li>)}</ul><button className={styles.logout} type="button">Logout placeholder</button></nav>; }
export function AccountShell({ children }: { children: React.ReactNode }) { return <Section><Container><div className={styles.shell}><aside className={styles.nav}><AccountNavigation /></aside><div className={styles.content}>{children}</div></div></Container></Section>; }
export function AccountHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <header className={styles.header}><span className={styles.eyebrow}>{eyebrow}</span><h1>{title}</h1><p className={styles.lede}>{description}</p></header>; }
