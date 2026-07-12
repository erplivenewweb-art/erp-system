import styles from "./HomePage.module.css";

export function SectionHeading({ description, eyebrow, title }: { description: string; eyebrow: string; title: string }) {
  return <header className={styles.sectionHeading}><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2><p>{description}</p></header>;
}
