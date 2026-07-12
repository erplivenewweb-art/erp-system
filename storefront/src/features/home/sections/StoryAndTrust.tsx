import Link from "next/link";
import type { HomeContent } from "../types";
import { MediaPlaceholder } from "../MediaPlaceholder";
import { SectionHeading } from "../SectionHeading";
import styles from "../HomePage.module.css";

export function ManufacturingSection({ content }: { content: HomeContent["manufacturing"] }) {
  return <section className={`${styles.section} ${styles.storySplit}`}><MediaPlaceholder media={content.media} /><div><SectionHeading {...content} /><Link className={styles.textAction} href={content.action.href}>{content.action.label}</Link></div></section>;
}

export function WorkshopSection({ content }: { content: HomeContent["workshop"] }) {
  return <section className={styles.section}><SectionHeading {...content} /><div className={styles.twoGrid}>{content.items.map((item) => <article className={styles.storyCard} key={item.title}>{item.media ? <MediaPlaceholder media={item.media} /> : null}<h3>{item.title}</h3><p>{item.description}</p><Link href={item.href}>Read the future story</Link></article>)}</div></section>;
}

export function PuritySection({ content }: { content: HomeContent["purity"] }) {
  return <section className={`${styles.section} ${styles.inverseSection}`}><SectionHeading {...content} /><div className={styles.factGrid}>{content.points.map((point) => <article key={point.title}><h3>{point.title}</h3><p>{point.description}</p></article>)}</div></section>;
}

export function PackagingSection({ content }: { content: HomeContent["packaging"] }) {
  return <section className={`${styles.section} ${styles.storySplit}`}><div><SectionHeading {...content} /><ul className={styles.checkList}>{content.points.map((point) => <li key={point}>{point}</li>)}</ul></div><MediaPlaceholder media={content.media} /></section>;
}

