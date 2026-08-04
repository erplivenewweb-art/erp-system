import Link from "next/link";
import { Container, Section } from "@/components/layout";
import { cmsNavigation } from "./data";
import styles from "./CMS.module.css";
export function CMSNavigation() {
  return (
    <nav aria-label="CMS">
      <h2>Content studio</h2>
      <ul>
        {cmsNavigation.map(([href, label]) => (
          <li key={href}>
            <Link href={href}>{label}</Link>
          </li>
        ))}
      </ul>
      <Link href="/">Exit to storefront</Link>
    </nav>
  );
}
export function CMSShell({ children }: { children: React.ReactNode }) {
  return (
    <Section>
      <Container>
        <div className={styles.shell}>
          <aside className={styles.nav}>
            <CMSNavigation />
          </aside>
          <div className={styles.content}>{children}</div>
        </div>
      </Container>
    </Section>
  );
}
export function CMSHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className={styles.header}>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h1>{title}</h1>
      <p className={styles.lede}>{description}</p>
    </header>
  );
}
