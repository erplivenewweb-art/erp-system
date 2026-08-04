"use client";
import { useState, type FormEvent } from "react";
import { CMSHeader, CMSShell } from "@/features/cms";
import { useSiteConfig } from "./SiteConfigProvider";
import type { SiteNavigationItem } from "./types";
import styles from "./SiteConfig.module.css";

export function SiteConfigManager({
  section,
}: {
  section: "navigation" | "footer" | "announcement" | "seo";
}) {
  const site = useSiteConfig();
  const [message, setMessage] = useState("");
  if (!site.enabled)
    return (
      <CMSShell>
        <CMSHeader
          eyebrow="Development only"
          title="Site configuration unavailable"
          description="This browser-local editor fails closed outside development."
        />
      </CMSShell>
    );
  if (!site.hydrated)
    return (
      <CMSShell>
        <p role="status">Restoring site configuration…</p>
      </CMSShell>
    );
  const save = (event: FormEvent) => {
    event.preventDefault();
    setMessage(
      site.save()
        ? "Site configuration saved in this browser."
        : "Configuration is invalid or browser storage is unavailable.",
    );
  };
  return (
    <CMSShell>
      <CMSHeader
        eyebrow="Development-only site configuration"
        title={`${section[0].toUpperCase()}${section.slice(1)} CMS`}
        description="Browser-local preview with no backend, ERP or production publication."
      />
      <div className={styles.status}>
        <span>{site.dirty ? "Unsaved changes" : "Saved"}</span>
        <span>Persistence: {site.status}</span>
      </div>
      <p aria-live="polite" className={styles.message} role="status">
        {message}
      </p>
      <form className={styles.editor} noValidate onSubmit={save}>
        {section === "navigation" ? <NavigationEditor /> : null}
        {section === "footer" ? <FooterEditor /> : null}
        {section === "announcement" ? <AnnouncementEditor /> : null}
        {section === "seo" ? <SEOEditor /> : null}
        <div className={styles.actions}>
          <button type="submit">Save configuration</button>
          <button
            onClick={() => {
              site.reset();
              setMessage("Draft reset to defaults.");
            }}
            type="button"
          >
            Reset draft
          </button>
          <button
            onClick={() => {
              site.restoreDefaults();
              setMessage("Defaults restored.");
            }}
            type="button"
          >
            Restore defaults
          </button>
        </div>
      </form>
    </CMSShell>
  );
}

function NavigationEditor() {
  const site = useSiteConfig();
  const items = site.content.navigation.toSorted(
    (a, b) => a.area.localeCompare(b.area) || a.sortOrder - b.sortOrder,
  );
  const change = (id: string, value: Partial<SiteNavigationItem>) =>
    site.update((current) => ({
      ...current,
      navigation: current.navigation.map((item) =>
        item.id === id ? { ...item, ...value } : item,
      ),
    }));
  const move = (item: SiteNavigationItem, delta: number) =>
    site.update((current) => {
      const group = current.navigation
        .filter((entry) => entry.area === item.area)
        .toSorted((a, b) => a.sortOrder - b.sortOrder);
      const index = group.findIndex((entry) => entry.id === item.id);
      const target = group[index + delta];
      if (!target) return current;
      return {
        ...current,
        navigation: current.navigation.map((entry) =>
          entry.id === item.id
            ? { ...entry, sortOrder: target.sortOrder }
            : entry.id === target.id
              ? { ...entry, sortOrder: item.sortOrder }
              : entry,
        ),
      };
    });
  return (
    <>
      <Field label="Header logo text">
        <input
          maxLength={60}
          onChange={(e) =>
            site.update((c) => ({
              ...c,
              header: { ...c.header, logoText: e.target.value },
            }))
          }
          value={site.content.header.logoText}
        />
      </Field>
      <Field label="Logo subtitle">
        <input
          maxLength={60}
          onChange={(e) =>
            site.update((c) => ({
              ...c,
              header: { ...c.header, logoSubtitle: e.target.value },
            }))
          }
          value={site.content.header.logoSubtitle}
        />
      </Field>
      <section className={styles.list}>
        <h2>Navigation items</h2>
        {items.map((item) => (
          <fieldset className={styles.card} key={item.id}>
            <legend>{item.label}</legend>
            <div className={styles.grid}>
              <Field label="Label">
                <input
                  maxLength={60}
                  onChange={(e) => change(item.id, { label: e.target.value })}
                  value={item.label}
                />
              </Field>
              <Field label="URL">
                <input
                  maxLength={200}
                  onChange={(e) => change(item.id, { url: e.target.value })}
                  value={item.url}
                />
              </Field>
              <Field label="Area">
                <select
                  onChange={(e) =>
                    change(item.id, {
                      area: e.target.value as SiteNavigationItem["area"],
                    })
                  }
                  value={item.area}
                >
                  <option>PRIMARY</option>
                  <option>SECONDARY</option>
                </select>
              </Field>
              <Field label="Sort order">
                <input
                  min="0"
                  onChange={(e) =>
                    change(item.id, { sortOrder: Number(e.target.value) })
                  }
                  type="number"
                  value={item.sortOrder}
                />
              </Field>
              <Field label="Development note">
                <input
                  maxLength={120}
                  onChange={(e) =>
                    change(item.id, { developmentNote: e.target.value })
                  }
                  value={item.developmentNote}
                />
              </Field>
              <Field label="Icon placeholder">
                <input
                  maxLength={40}
                  onChange={(e) => change(item.id, { icon: e.target.value })}
                  value={item.icon}
                />
              </Field>
            </div>
            <label>
              <input
                checked={item.visible}
                onChange={(e) => change(item.id, { visible: e.target.checked })}
                type="checkbox"
              />{" "}
              Visible
            </label>
            <label>
              <input
                checked={item.openInNewTab}
                onChange={(e) =>
                  change(item.id, { openInNewTab: e.target.checked })
                }
                type="checkbox"
              />{" "}
              Open in new tab
            </label>
            <div className={styles.actions}>
              <button onClick={() => move(item, -1)} type="button">
                Move up
              </button>
              <button onClick={() => move(item, 1)} type="button">
                Move down
              </button>
              <button
                onClick={() =>
                  site.update((c) => ({
                    ...c,
                    navigation: [
                      ...c.navigation,
                      {
                        ...structuredClone(item),
                        id: `${item.id}-copy-${c.navigation.length}`,
                        label: `${item.label} Copy`,
                        sortOrder: item.sortOrder + 1,
                      },
                    ],
                  }))
                }
                type="button"
              >
                Duplicate
              </button>
              <button
                onClick={() =>
                  site.update((c) => ({
                    ...c,
                    navigation: c.navigation.filter(
                      (entry) => entry.id !== item.id,
                    ),
                  }))
                }
                type="button"
              >
                Delete
              </button>
            </div>
          </fieldset>
        ))}
        <button
          onClick={() =>
            site.update((c) => ({
              ...c,
              navigation: [
                ...c.navigation,
                {
                  id: `nav-local-${c.navigation.length + 1}`,
                  label: "New link",
                  url: "/",
                  area: "PRIMARY",
                  visible: true,
                  sortOrder: c.navigation.length + 1,
                  openInNewTab: false,
                  developmentNote: "Development navigation",
                  icon: "placeholder",
                },
              ],
            }))
          }
          type="button"
        >
          Create navigation item
        </button>
      </section>
    </>
  );
}

function FooterEditor() {
  const site = useSiteConfig();
  const footer = site.content.footer;
  const set = (value: Partial<typeof footer>) =>
    site.update((c) => ({ ...c, footer: { ...c.footer, ...value } }));
  const updateLink = (
    id: string,
    value: Partial<(typeof footer.links)[number]>,
  ) =>
    set({
      links: footer.links.map((item) =>
        item.id === id ? { ...item, ...value } : item,
      ),
    });
  return (
    <section>
      <h2>Footer content and links</h2>
      <div className={styles.grid}>
        {(
          [
            ["Company name", "companyName"],
            ["Short description", "description"],
            ["Copyright", "copyright"],
            ["Phone", "phone"],
            ["Email", "email"],
            ["Address", "address"],
            ["WhatsApp label", "whatsappLabel"],
            ["Instagram", "instagram"],
            ["Facebook", "facebook"],
            ["YouTube", "youtube"],
            ["Footer notice", "notice"],
          ] as const
        ).map(([label, key]) => (
          <Field key={key} label={label}>
            <input
              maxLength={key === "description" || key === "address" ? 240 : 120}
              onChange={(e) => set({ [key]: e.target.value })}
              value={footer[key]}
            />
          </Field>
        ))}
      </div>
      <h3>Footer links</h3>
      <div className={styles.grid}>
        {footer.links.map((item) => (
          <fieldset className={styles.card} key={item.id}>
            <legend>{item.group}</legend>
            <Field label="Link label">
              <input
                maxLength={80}
                onChange={(event) =>
                  updateLink(item.id, { label: event.target.value })
                }
                value={item.label}
              />
            </Field>
            <Field label="Link URL">
              <input
                maxLength={240}
                onChange={(event) =>
                  updateLink(item.id, { url: event.target.value })
                }
                value={item.url}
              />
            </Field>
            <span>
              {item.group}: {item.label} — {item.url}
            </span>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
function AnnouncementEditor() {
  const site = useSiteConfig();
  const a = site.content.announcement;
  const set = (value: Partial<typeof a>) =>
    site.update((c) => ({
      ...c,
      announcement: { ...c.announcement, ...value },
    }));
  return (
    <section>
      <h2>Announcement preview</h2>
      <div className={styles.preview} data-background={a.backgroundToken}>
        {a.festivalBadge ? <strong>{a.festivalBadge}</strong> : null}
        <span>{a.message}</span>
        <span>{a.ctaLabel}</span>
      </div>
      <div className={styles.grid}>
        <Field label="Message">
          <input
            maxLength={160}
            onChange={(e) => set({ message: e.target.value })}
            value={a.message}
          />
        </Field>
        <Field label="CTA label">
          <input
            maxLength={60}
            onChange={(e) => set({ ctaLabel: e.target.value })}
            value={a.ctaLabel}
          />
        </Field>
        <Field label="CTA URL">
          <input
            onChange={(e) => set({ ctaUrl: e.target.value })}
            value={a.ctaUrl}
          />
        </Field>
        <Field label="Background token">
          <select
            onChange={(e) =>
              set({
                backgroundToken: e.target.value as typeof a.backgroundToken,
              })
            }
            value={a.backgroundToken}
          >
            <option value="surface-inverse">Surface inverse</option>
            <option value="brand-silver">Brand silver</option>
            <option value="brand-vermilion">Brand vermilion</option>
          </select>
        </Field>
        <Field label="Text token">
          <select
            onChange={(e) =>
              set({ textToken: e.target.value as typeof a.textToken })
            }
            value={a.textToken}
          >
            <option value="text-inverse">Text inverse</option>
            <option value="text-primary">Text primary</option>
          </select>
        </Field>
        <Field label="Priority">
          <input
            onChange={(e) => set({ priority: Number(e.target.value) })}
            type="number"
            value={a.priority}
          />
        </Field>
        <Field label="Festival badge">
          <input
            maxLength={40}
            onChange={(e) => set({ festivalBadge: e.target.value })}
            value={a.festivalBadge}
          />
        </Field>
      </div>
      <label>
        <input
          checked={a.visible}
          onChange={(e) => set({ visible: e.target.checked })}
          type="checkbox"
        />{" "}
        Visible
      </label>
      <label>
        <input
          checked={a.dismissible}
          onChange={(e) => set({ dismissible: e.target.checked })}
          type="checkbox"
        />{" "}
        Dismissible preview
      </label>
    </section>
  );
}
function SEOEditor() {
  const site = useSiteConfig();
  const seo = site.content.seo;
  const set = (value: Partial<typeof seo>) =>
    site.update((c) => ({ ...c, seo: { ...c.seo, ...value } }));
  return (
    <section>
      <h2>Metadata preview only</h2>
      <div className={styles.preview}>
        <strong>{seo.homepageTitle}</strong>
        <span>{seo.homepageDescription}</span>
        <span>{seo.canonicalBaseUrl}</span>
        <span>
          {seo.noindex ? "noindex" : "index"},{" "}
          {seo.nofollow ? "nofollow" : "follow"}
        </span>
      </div>
      <div className={styles.grid}>
        {(
          [
            ["Homepage title", "homepageTitle"],
            ["Homepage description", "homepageDescription"],
            ["Product title template", "productTitleTemplate"],
            ["Category title template", "categoryTitleTemplate"],
            ["Collection title template", "collectionTitleTemplate"],
            ["OpenGraph title", "openGraphTitle"],
            ["OpenGraph description", "openGraphDescription"],
            ["Twitter title", "twitterTitle"],
            ["Twitter description", "twitterDescription"],
            ["Canonical base URL", "canonicalBaseUrl"],
            ["Robots", "robots"],
          ] as const
        ).map(([label, key]) => (
          <Field key={key} label={label}>
            <input
              maxLength={key.includes("Description") ? 240 : 160}
              onChange={(e) => set({ [key]: e.target.value })}
              value={seo[key]}
            />
          </Field>
        ))}
      </div>
      <label>
        <input
          checked={seo.noindex}
          onChange={(e) => set({ noindex: e.target.checked })}
          type="checkbox"
        />{" "}
        Noindex preview
      </label>
      <label>
        <input
          checked={seo.nofollow}
          onChange={(e) => set({ nofollow: e.target.checked })}
          type="checkbox"
        />{" "}
        Nofollow preview
      </label>
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}
