# Accessibility Baseline

WCAG 2.2 AA foundation verified across public, commerce, customer, dealer and CMS screens.

- Keyboard: navigation, controls, tabs, accordions, gallery, tables, dialogs and drawers operable.
- Focus: global visible focus ring; modal/drawer entry and trigger restoration verified.
- Structure: skip link, header/nav/main/footer landmarks, stable one-H1 hierarchy and semantic sections.
- Forms: associated labels, help/validation, native choices, autocomplete where appropriate and 44px touch targets.
- Tables: captions, row/column headers and bounded focusable overflow regions.
- Motion: global `prefers-reduced-motion` override plus component-specific fallbacks.
- Status: loading, error, toast, empty and validation announcements use appropriate roles/live regions.

Automated axe coverage spans homepage/shell, catalogue/product, cart/checkout, account/profile, dealer and CMS. Known testing exception: JSDOM color-contrast computation is disabled because CSS custom properties are not rendered; semantic token colors were visually audited. OS/device assistive-technology combinations remain release-environment QA.
