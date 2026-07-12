# SEO and Accessibility

Indexable catalogue routes include static title, description, relative canonical strategy and OpenGraph-ready metadata without inventing a production domain. Search and comparison shells are `noindex, follow`. Every tested screen has exactly one H1 and semantic heading order, landmarks, breadcrumbs and internal link shells.

The foundation targets WCAG 2.2 AA: meaningful placeholder alt text, named gallery tabs, labelled filters, semantic tables/captions, native disclosures, 44px-compatible controls, visible focus styles and reduced-motion-safe CSS. Automated axe checks for the shop and product screens reported zero violations with color contrast disabled because JSDOM cannot compute rendered token colors; rendered token contrast and focus were reviewed in-browser.

No unsafe HTML, external scripts, secrets, ERP route strings or internal API calls exist. Structured-data fields are ready in the typed content model, but no unapproved JSON-LD claims were emitted.
