import Link from "next/link";
import { ProductCardShell } from "@/components/commerce";
import type { HomeContent } from "../types";
import { MediaPlaceholder } from "../MediaPlaceholder";
import { SectionHeading } from "../SectionHeading";
import styles from "../HomePage.module.css";

export function HeroSection({ content }: { content: HomeContent["hero"] }) {
  return <section aria-labelledby="home-title" className={styles.hero}><div className={styles.heroCopy}><p className={styles.eyebrow}>{content.eyebrow}</p><h1 id="home-title">{content.title}</h1><p>{content.description}</p><div className={styles.actions}><Link className={styles.primaryAction} href={content.primary.href}>{content.primary.label}</Link><Link className={styles.secondaryAction} href={content.secondary.href}>{content.secondary.label}</Link></div></div><MediaPlaceholder media={content.media} /></section>;
}

export function TrustStrip({ items }: { items: HomeContent["trust"] }) {
  return <section aria-label="Why Silver Sankha" className={styles.trustStrip}>{items.map((item) => <article key={item.title}><h2>{item.title}</h2><p>{item.description}</p></article>)}</section>;
}

export function CollectionsSection({ content }: { content: HomeContent["collections"] }) {
  return <section className={styles.section}><SectionHeading {...content} /><div className={styles.collectionGrid}>{content.items.map((item) => <article className={styles.editorialCard} key={item.title}>{item.media ? <MediaPlaceholder media={item.media} /> : null}<div><h3>{item.title}</h3><p>{item.description}</p><Link href={item.href}>Explore {item.title}</Link></div></article>)}</div></section>;
}

export function ProductsSection({ content }: { content: HomeContent["products"] }) {
  return <section className={`${styles.section} ${styles.subtleSection}`}><SectionHeading {...content} /><div className={styles.productGrid}>{content.items.map((item) => <ProductCardShell availability={item.availability} key={item.name} name={item.name} priceLabel="Retail details forthcoming" />)}</div><p className={styles.syntheticNote}>Synthetic homepage product shells. No live retail price, wholesale price or stock is shown.</p></section>;
}

