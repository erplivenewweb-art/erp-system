"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { footerGroups } from "@/config/public-navigation";
import { useCMSContent } from "@/features/cms";
import { useSiteConfig } from "@/features/site-config-simulation";
import styles from "./PublicShell.module.css";

const socialLinks = [
  { href: "/social/instagram", icon: "instagram" as const, label: "Instagram" },
  { href: "/social/facebook", icon: "facebook" as const, label: "Facebook" },
  { href: "/social/youtube", icon: "youtube" as const, label: "YouTube" },
  { href: "/social/pinterest", icon: "pinterest" as const, label: "Pinterest" },
];

export function PublicFooter() {
  const { content } = useCMSContent();
  const site = useSiteConfig();
  const footer = content.marketing.footer;
  const configuredSocialLinks = site.enabled
    ? [
        {
          href: site.content.footer.instagram,
          icon: "instagram" as const,
          label: "Instagram",
        },
        {
          href: site.content.footer.facebook,
          icon: "facebook" as const,
          label: "Facebook",
        },
        {
          href: site.content.footer.youtube,
          icon: "youtube" as const,
          label: "YouTube",
        },
      ]
    : socialLinks;
  const configuredGroups = site.enabled
    ? ["COLLECTIONS", "CUSTOMER", "WHOLESALE", "POLICIES"].map((title) => ({
        title,
        links: site.content.footer.links
          .filter((link) => link.group === title)
          .map((link) => ({ label: link.label, href: link.url })),
      }))
    : footerGroups;
  return (
    <footer className={styles.footer} data-testid="public-footer">
      <Link
        aria-label="Contact Silver Sankha on WhatsApp"
        className={styles.whatsappFloating}
        href="/whatsapp"
      >
        <Icon name="whatsapp" />
        <span>
          {site.enabled
            ? site.content.footer.whatsappLabel
            : content.marketing.whatsappCta}
        </span>
      </Link>
      <div className={styles.footerIntro}>
        <div className={styles.footerStory}>
          <p className={styles.eyebrow}>{site.content.footer.companyName}</p>
          <h2>{site.content.footer.description}</h2>
          <p>{footer.disclaimer}</p>
        </div>
        <section
          aria-labelledby="newsletter-title"
          className={styles.newsletter}
        >
          <p className={styles.eyebrow}>Occasional letters</p>
          <h2 id="newsletter-title">Craft notes and collection news</h2>
          <p>UI preview only. Subscription processing is not connected.</p>
          <form action="#" className={styles.newsletterForm}>
            <label htmlFor="newsletter-email">Email address</label>
            <div>
              <input
                autoComplete="email"
                id="newsletter-email"
                name="email"
                placeholder="you@example.com"
                type="email"
              />
              <button type="submit">Subscribe</button>
            </div>
          </form>
        </section>
      </div>
      <div className={styles.footerLinks}>
        {configuredGroups.map((group) => (
          <nav aria-label={group.title} key={group.title}>
            <h2>{group.title}</h2>
            <ul>
              {group.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className={styles.footerContact}>
        <div>
          <p>Customer care</p>
          {site.enabled ? (
            <>
              <span>{site.content.footer.phone}</span>
              <span>{site.content.footer.email}</span>
              <span>{site.content.footer.address}</span>
            </>
          ) : null}
          <Link href="/contact">Contact the jewellery house</Link>
          <Link href="/whatsapp">
            <Icon name="whatsapp" />
            {site.enabled
              ? site.content.footer.whatsappLabel
              : content.marketing.whatsappCta}
          </Link>
        </div>
        <div className={styles.socials} aria-label="Social links">
          {configuredSocialLinks.map((social) => (
            <Link
              aria-label={social.label}
              href={social.href}
              key={social.label}
            >
              <Icon name={social.icon} />
            </Link>
          ))}
        </div>
      </div>
      <div className={styles.legal}>
        <small>
          © {site.enabled ? site.content.footer.copyright : footer.copyright}
        </small>
        <small>
          {site.enabled ? site.content.footer.notice : footer.developmentNotice}
        </small>
      </div>
    </footer>
  );
}
