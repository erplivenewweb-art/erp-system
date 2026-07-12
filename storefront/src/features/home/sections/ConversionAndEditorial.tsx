import Link from "next/link";
import { Accordion } from "@/components/navigation";
import type { HomeContent } from "../types";
import { MediaPlaceholder } from "../MediaPlaceholder";
import { SectionHeading } from "../SectionHeading";
import styles from "../HomePage.module.css";

export function CustomSection({ content }: { content: HomeContent["custom"] }) {
  return <section className={`${styles.section} ${styles.customCard}`}><MediaPlaceholder media={content.media} /><div><p className={styles.eyebrow}>{content.eyebrow}</p><h2>{content.title}</h2><p>{content.description}</p><Link className={styles.secondaryAction} href={content.action.href}>{content.action.label}</Link></div></section>;
}

export function WholesaleSection({ content }: { content: HomeContent["wholesale"] }) {
  return <section className={`${styles.section} ${styles.wholesaleCard}`}><p className={styles.eyebrow}>{content.eyebrow}</p><h2>{content.title}</h2><p>{content.description}</p><ul>{content.points.map((point) => <li key={point}>{point}</li>)}</ul><Link className={styles.inverseAction} href={content.action.href}>{content.action.label}</Link></section>;
}

export function ReviewsSection({ content }: { content: HomeContent["reviews"] }) {
  return <section className={`${styles.section} ${styles.subtleSection}`}><SectionHeading {...content} /><div className={styles.twoGrid}>{content.items.map((item, index) => <article className={styles.reviewCard} key={index}><p className={styles.placeholderLabel}>Synthetic placeholder — not a verified review</p><blockquote>{item.text}</blockquote><p><strong>{item.author}</strong></p></article>)}</div></section>;
}

export function SocialSection({ content }: { content: HomeContent["social"] }) {
  return <section className={styles.section}><SectionHeading {...content} /><div className={styles.twoGrid}>{content.items.map((item) => <article className={styles.storyCard} key={item.title}>{item.media ? <MediaPlaceholder media={item.media} /> : null}<h3>{item.title}</h3><p>{item.description}</p><Link href={item.href}>View channel placeholder</Link></article>)}</div></section>;
}

export function JournalSection({ content }: { content: HomeContent["journal"] }) {
  return <section className={styles.section}><SectionHeading {...content} /><div className={styles.journalGrid}>{content.items.map((item) => <article key={item.title}><p className={styles.eyebrow}>CMS article preview</p><h3>{item.title}</h3><p>{item.description}</p><Link href={item.href}>Read future guide</Link></article>)}</div></section>;
}

export function FaqSection({ content }: { content: HomeContent["faq"] }) {
  return <section className={`${styles.section} ${styles.faqSplit}`}><SectionHeading {...content} /><div><Accordion items={content.items.map((item) => ({ id: item.id, title: item.question, content: <p>{item.answer}</p> }))} /><Link className={styles.textAction} href={content.action.href}>{content.action.label}</Link></div></section>;
}
