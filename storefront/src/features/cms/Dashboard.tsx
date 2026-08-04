"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { CMSHeader, CMSShell } from "./CMSShell";
import { useCMSContent } from "./CMSContentProvider";
import type { AnnouncementPreset } from "./types";
import styles from "./CMS.module.css";

export function CMSDashboard() {
  const cms = useCMSContent();
  const [message, setMessage] = useState("");
  const statusRef = useRef<HTMLParagraphElement>(null);

  function announce(value: string) {
    setMessage(value);
    queueMicrotask(() => statusRef.current?.focus());
  }

  function save(event: FormEvent) {
    event.preventDefault();
    announce(
      cms.save()
        ? "Development CMS content saved in this browser."
        : "Content could not be saved. Complete required fields and check browser storage.",
    );
  }

  if (!cms.enabled)
    return (
      <CMSShell>
        <CMSHeader
          description="The browser-only editor is disabled outside local development."
          eyebrow="Safe production posture"
          title="CMS simulation unavailable"
        />
        <div className={styles.empty} role="alert">
          No editor, storage, API, authentication, or backend fallback is
          active.
        </div>
      </CMSShell>
    );

  if (!cms.hydrated)
    return (
      <CMSShell>
        <p role="status">Restoring development CMS content…</p>
      </CMSShell>
    );

  const { hero, sections } = cms.content.homepage;
  const marketing = cms.content.marketing;

  return (
    <CMSShell>
      <CMSHeader
        description="Edit fictional homepage and marketing copy locally. Changes appear in the live preview and homepage immediately; Save persists them only in this browser."
        eyebrow="Development-only content studio"
        title="CMS simulation"
      />
      <div className={styles.statusRow}>
        <span className={styles.badge}>Browser-only simulation</span>
        <strong>{cms.dirty ? "Unsaved changes" : "All changes saved"}</strong>
        <span>Storage: {cms.persistenceStatus}</span>
      </div>
      <p
        aria-live="polite"
        className={styles.statusMessage}
        ref={statusRef}
        role="status"
        tabIndex={-1}
      >
        {message}
      </p>
      <form className={styles.editorLayout} noValidate onSubmit={save}>
        <div className={styles.editorColumn}>
          <EditorSection title="Homepage hero">
            <TextEditor
              label="Hero badge"
              maxLength={60}
              onChange={(badge) => cms.updateHero({ badge })}
              value={hero.badge}
            />
            <TextEditor
              label="Hero headline"
              maxLength={120}
              onChange={(title) => cms.updateHero({ title })}
              value={hero.title}
            />
            <TextEditor
              area
              label="Hero sub-heading"
              maxLength={280}
              onChange={(subtitle) => cms.updateHero({ subtitle })}
              value={hero.subtitle}
            />
            <TextEditor
              label="Primary CTA"
              maxLength={40}
              onChange={(primaryCta) => cms.updateHero({ primaryCta })}
              value={hero.primaryCta}
            />
            <TextEditor
              label="Secondary CTA"
              maxLength={40}
              onChange={(secondaryCta) => cms.updateHero({ secondaryCta })}
              value={hero.secondaryCta}
            />
            <TextEditor
              label="Hero image placeholder label"
              maxLength={80}
              onChange={(mediaLabel) => cms.updateHero({ mediaLabel })}
              value={hero.mediaLabel}
            />
            <Toggle
              checked={hero.festivalBannerEnabled}
              label="Show festival banner"
              onChange={(festivalBannerEnabled) =>
                cms.updateHero({ festivalBannerEnabled })
              }
            />
            <TextEditor
              label="Festival banner text"
              maxLength={100}
              onChange={(festivalBannerText) =>
                cms.updateHero({ festivalBannerText })
              }
              value={hero.festivalBannerText}
            />
          </EditorSection>

          <EditorSection title="Homepage sections">
            <SectionEditor
              checked={sections.trendingEnabled}
              description={sections.trendingDescription}
              label="Trending products"
              onDescription={(trendingDescription) =>
                cms.updateSections({ trendingDescription })
              }
              onEnabled={(trendingEnabled) =>
                cms.updateSections({ trendingEnabled })
              }
              onTitle={(trendingTitle) => cms.updateSections({ trendingTitle })}
              title={sections.trendingTitle}
            />
            <SectionEditor
              checked={sections.newArrivalsEnabled}
              description={sections.newArrivalsDescription}
              label="New arrivals"
              onDescription={(newArrivalsDescription) =>
                cms.updateSections({ newArrivalsDescription })
              }
              onEnabled={(newArrivalsEnabled) =>
                cms.updateSections({ newArrivalsEnabled })
              }
              onTitle={(newArrivalsTitle) =>
                cms.updateSections({ newArrivalsTitle })
              }
              title={sections.newArrivalsTitle}
            />
            <SectionEditor
              checked={sections.featuredCollectionsEnabled}
              description={sections.collectionsDescription}
              label="Featured collections"
              onDescription={(collectionsDescription) =>
                cms.updateSections({ collectionsDescription })
              }
              onEnabled={(featuredCollectionsEnabled) =>
                cms.updateSections({ featuredCollectionsEnabled })
              }
              onTitle={(collectionsTitle) =>
                cms.updateSections({ collectionsTitle })
              }
              title={sections.collectionsTitle}
            />
            <SectionEditor
              checked={sections.editorialEnabled}
              description={sections.editorialDescription}
              label="Editorial section"
              onDescription={(editorialDescription) =>
                cms.updateSections({ editorialDescription })
              }
              onEnabled={(editorialEnabled) =>
                cms.updateSections({ editorialEnabled })
              }
              onTitle={(editorialTitle) =>
                cms.updateSections({ editorialTitle })
              }
              title={sections.editorialTitle}
            />
            <SectionEditor
              checked={sections.aboutEnabled}
              description={sections.aboutParagraph}
              label="About preview"
              onDescription={(aboutParagraph) =>
                cms.updateSections({ aboutParagraph })
              }
              onEnabled={(aboutEnabled) => cms.updateSections({ aboutEnabled })}
              onTitle={(aboutHeading) => cms.updateSections({ aboutHeading })}
              title={sections.aboutHeading}
            />
            <SectionEditor
              checked={sections.contactEnabled}
              description={sections.contactDescription}
              label="Contact preview"
              onDescription={(contactDescription) =>
                cms.updateSections({ contactDescription })
              }
              onEnabled={(contactEnabled) =>
                cms.updateSections({ contactEnabled })
              }
              onTitle={(contactHeading) =>
                cms.updateSections({ contactHeading })
              }
              title={sections.contactHeading}
            />
            <TextEditor
              label="Contact phone placeholder"
              maxLength={120}
              onChange={(contactPhone) => cms.updateSections({ contactPhone })}
              value={sections.contactPhone}
            />
            <TextEditor
              label="Contact email placeholder"
              maxLength={120}
              onChange={(contactEmail) => cms.updateSections({ contactEmail })}
              value={sections.contactEmail}
            />
          </EditorSection>

          <EditorSection title="Marketing">
            <Toggle
              checked={marketing.announcement.enabled}
              label="Enable announcement bar"
              onChange={(enabled) => cms.updateAnnouncement({ enabled })}
            />
            <TextEditor
              label="Announcement text"
              maxLength={120}
              onChange={(text) => cms.updateAnnouncement({ text })}
              value={marketing.announcement.text}
            />
            <TextEditor
              label="Announcement CTA label"
              maxLength={40}
              onChange={(ctaLabel) => cms.updateAnnouncement({ ctaLabel })}
              value={marketing.announcement.ctaLabel}
            />
            <label className={styles.field}>
              <span>Announcement color preset</span>
              <select
                onChange={(event) =>
                  cms.updateAnnouncement({
                    colorPreset: event.target.value as AnnouncementPreset,
                  })
                }
                value={marketing.announcement.colorPreset}
              >
                <option value="ink">Ink</option>
                <option value="silver">Silver</option>
                <option value="vermilion">Vermilion</option>
              </select>
            </label>
            <TextEditor
              label="WhatsApp CTA"
              maxLength={40}
              onChange={(whatsappCta) => cms.updateMarketing({ whatsappCta })}
              value={marketing.whatsappCta}
            />
            <TextEditor
              label="Wholesale headline"
              maxLength={120}
              onChange={(headline) => cms.updateWholesale({ headline })}
              value={marketing.wholesale.headline}
            />
            <TextEditor
              area
              label="Wholesale description"
              maxLength={280}
              onChange={(description) => cms.updateWholesale({ description })}
              value={marketing.wholesale.description}
            />
            <TextEditor
              label="Wholesale CTA"
              maxLength={40}
              onChange={(ctaLabel) => cms.updateWholesale({ ctaLabel })}
              value={marketing.wholesale.ctaLabel}
            />
            <Toggle
              checked={marketing.seasonalCampaign.enabled}
              label="Enable seasonal campaign"
              onChange={(enabled) => cms.updateSeasonal({ enabled })}
            />
            <TextEditor
              label="Seasonal campaign headline"
              maxLength={120}
              onChange={(headline) => cms.updateSeasonal({ headline })}
              value={marketing.seasonalCampaign.headline}
            />
            <TextEditor
              area
              label="Seasonal campaign description"
              maxLength={280}
              onChange={(description) => cms.updateSeasonal({ description })}
              value={marketing.seasonalCampaign.description}
            />
          </EditorSection>

          <EditorSection title="Footer">
            <TextEditor
              label="Copyright"
              maxLength={120}
              onChange={(copyright) => cms.updateFooter({ copyright })}
              value={marketing.footer.copyright}
            />
            <TextEditor
              area
              label="Footer disclaimer"
              maxLength={200}
              onChange={(disclaimer) => cms.updateFooter({ disclaimer })}
              value={marketing.footer.disclaimer}
            />
            <TextEditor
              area
              label="Footer development notice"
              maxLength={160}
              onChange={(developmentNotice) =>
                cms.updateFooter({ developmentNotice })
              }
              value={marketing.footer.developmentNotice}
            />
          </EditorSection>

          <div className={styles.actions}>
            <button
              className={`${styles.button} ${styles.primary}`}
              type="submit"
            >
              Save local content
            </button>
            <button
              className={styles.button}
              onClick={() => {
                cms.resetHomepage();
                announce("Homepage reset to defaults. Save to persist.");
              }}
              type="button"
            >
              Reset homepage
            </button>
            <button
              className={styles.button}
              onClick={() => {
                cms.resetMarketing();
                announce("Marketing reset to defaults. Save to persist.");
              }}
              type="button"
            >
              Reset marketing
            </button>
            <button
              className={styles.button}
              onClick={() => {
                cms.resetEverything();
                announce("All fields reset to defaults. Save to persist.");
              }}
              type="button"
            >
              Reset everything
            </button>
            <button
              className={styles.dangerButton}
              onClick={() =>
                announce(
                  cms.restoreDefaults()
                    ? "Defaults restored and local CMS storage cleared."
                    : "Defaults restored, but browser storage was unavailable.",
                )
              }
              type="button"
            >
              Restore defaults
            </button>
          </div>
        </div>
        <aside
          aria-label="Live homepage preview"
          className={styles.livePreview}
        >
          <span className={styles.badge}>Live preview</span>
          {marketing.announcement.enabled ? (
            <p
              className={styles.previewAnnouncement}
              data-preset={marketing.announcement.colorPreset}
            >
              {marketing.announcement.text} · {marketing.announcement.ctaLabel}
            </p>
          ) : null}
          {hero.festivalBannerEnabled ? <p>{hero.festivalBannerText}</p> : null}
          <p className={styles.eyebrow}>{hero.badge}</p>
          <h2>{hero.title}</h2>
          <p>{hero.subtitle}</p>
          <div className={styles.actions}>
            <span className={styles.previewAction}>{hero.primaryCta}</span>
            <span className={styles.previewAction}>{hero.secondaryCta}</span>
          </div>
          <div className={styles.media} role="img" aria-label={hero.mediaLabel}>
            Hero media placeholder
          </div>
          {sections.featuredCollectionsEnabled ? (
            <>
              <h3>{sections.collectionsTitle}</h3>
              <p>{sections.collectionsDescription}</p>
            </>
          ) : null}
          <h3>{marketing.wholesale.headline}</h3>
          <p>{marketing.wholesale.description}</p>
          <Link href="/">Open full homepage preview</Link>
        </aside>
      </form>
    </CMSShell>
  );
}

function EditorSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <fieldset className={styles.card}>
      <legend>{title}</legend>
      <div className={styles.formGrid}>{children}</div>
    </fieldset>
  );
}

function TextEditor({
  area = false,
  label,
  maxLength,
  onChange,
  value,
}: {
  area?: boolean;
  label: string;
  maxLength: number;
  onChange(value: string): void;
  value: string;
}) {
  const id = `cms-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label
      className={`${styles.field} ${area ? styles.wide : ""}`}
      htmlFor={id}
    >
      <span>{label}</span>
      {area ? (
        <textarea
          id={id}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          required
          value={value}
        />
      ) : (
        <input
          id={id}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          required
          type="text"
          value={value}
        />
      )}
    </label>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange(value: boolean): void;
}) {
  return (
    <label className={styles.toggle}>
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

function SectionEditor({
  checked,
  description,
  label,
  onDescription,
  onEnabled,
  onTitle,
  title,
}: {
  checked: boolean;
  description: string;
  label: string;
  onDescription(value: string): void;
  onEnabled(value: boolean): void;
  onTitle(value: string): void;
  title: string;
}) {
  return (
    <div className={styles.sectionEditor}>
      <Toggle checked={checked} label={`Show ${label}`} onChange={onEnabled} />
      <TextEditor
        label={`${label} title`}
        maxLength={120}
        onChange={onTitle}
        value={title}
      />
      <TextEditor
        area
        label={`${label} description`}
        maxLength={280}
        onChange={onDescription}
        value={description}
      />
    </div>
  );
}
