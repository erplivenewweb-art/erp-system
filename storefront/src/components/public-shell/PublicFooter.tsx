import Link from "next/link";
import { Icon } from "@/components/icons";
import { footerGroups } from "@/config/public-navigation";
import styles from "./PublicShell.module.css";

const socialLinks = [
  { href: "/social/instagram", icon: "instagram" as const, label: "Instagram" },
  { href: "/social/facebook", icon: "facebook" as const, label: "Facebook" },
  { href: "/social/youtube", icon: "youtube" as const, label: "YouTube" },
  { href: "/social/pinterest", icon: "pinterest" as const, label: "Pinterest" },
];

export function PublicFooter() {
  return (
    <footer className={styles.footer} data-testid="public-footer">
      <Link aria-label="Contact Silver Sankha on WhatsApp" className={styles.whatsappFloating} href="/whatsapp"><Icon name="whatsapp" /><span>WhatsApp</span></Link>
      <div className={styles.footerIntro}>
        <div className={styles.footerStory}>
          <p className={styles.eyebrow}>Silver Sankha Jewellery House</p>
          <h2>Made with discipline. Shared with warmth.</h2>
          <p>A CMS-ready home for approved brand, manufacturing and customer-care stories. No unverified claims are published in this shell.</p>
        </div>
        <section aria-labelledby="newsletter-title" className={styles.newsletter}>
          <p className={styles.eyebrow}>Occasional letters</p>
          <h2 id="newsletter-title">Craft notes and collection news</h2>
          <p>UI preview only. Subscription processing is not connected.</p>
          <form action="#" className={styles.newsletterForm}>
            <label htmlFor="newsletter-email">Email address</label>
            <div><input autoComplete="email" id="newsletter-email" name="email" placeholder="you@example.com" type="email" /><button type="submit">Subscribe</button></div>
          </form>
        </section>
      </div>
      <div className={styles.footerLinks}>{footerGroups.map((group) => <nav aria-label={group.title} key={group.title}><h2>{group.title}</h2><ul>{group.links.map((link) => <li key={link.label}><Link href={link.href}>{link.label}</Link></li>)}</ul></nav>)}</div>
      <div className={styles.footerContact}>
        <div><p>Customer care</p><Link href="/contact">Contact the jewellery house</Link><Link href="/whatsapp"><Icon name="whatsapp" />WhatsApp</Link></div>
        <div className={styles.socials} aria-label="Social links">{socialLinks.map((social) => <Link aria-label={social.label} href={social.href} key={social.label}><Icon name={social.icon} /></Link>)}</div>
      </div>
      <div className={styles.legal}><small>© {new Date().getFullYear()} Silver Sankha. Public shell preview.</small><small>Content ownership: Brand and Commerce CMS teams.</small></div>
    </footer>
  );
}
