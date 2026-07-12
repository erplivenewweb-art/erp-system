# Loading — High-Fidelity Screen Specification

## Visual hierarchy

Lead with Stable shell; sequence Content-shaped skeletons → Progress label → Timeout recovery. One dominant action and restrained evidence-led supporting actions.

## Grid

Mobile 4 columns/16px gutter; tablet 8/24px; desktop 12/32px; max 1440px; editorial reading measure 720px.

## Spacing

Use 4px base; 24–32px component groups, 48–80px sections mobile/tablet, 80–128px desktop editorial sections; density reduces only in dealer/CMS operational regions.

## Typography

One display/H1; serif display for editorial titles only; sans body/UI; 16px minimum body; tabular numerals for price/metrics; responsive clamp without line or layout clipping.

## Color usage

Gallery Ivory canvas, Brand Ink text, white raised surfaces, silver borders/details, vermilion one-primary-accent maximum, semantic colors for states; decorative gold never conveys status.

## Motion

160ms controls, 240ms navigation/layout, ≤420ms editorial reveal; transform/opacity only; reduced-motion static equivalent; no essential autoplay.

## CTA hierarchy

Primary filled ink or inverse high-contrast button; secondary outline/text; destructive separated and confirmed; dealer/admin high-risk actions use explicit labels.

## Component usage

- Stable shell
- Content-shaped skeletons
- Progress label
- Timeout recovery
- Header/navigation
- Breadcrumb when hierarchical
- Footer/help
- Loading/empty/error variants

## Responsive rules

Mobile source order is canonical; tablet composes paired regions; desktop may split editorial/task columns. Sticky regions disable when viewport/zoom cannot fit. No hover-only information.

## Accessibility

WCAG 2.2 AA; logical landmarks/headings/focus; 44px targets; keyboard/screen-reader complete; 3:1 focus; 4.5:1 normal text; 200% zoom; state not color-only; reduced motion.

## SEO placeholders

- Document title/meta/canonical intent
- One H1 and structured headings
- Breadcrumb/schema placeholder when public and eligible
- CMS-provided OG/social image
- Private/state screens noindex

## CMS editable zones

- Approved editorial copy/media/SEO only
- CTA labels/destinations within allowlist
- Transactional, price, stock, identity and ERP-derived facts are not freeform CMS fields

## Dark mode

Map semantic surfaces/text/borders; protect product color accuracy; no image inversion; use charcoal not pure black; revalidate all contrast and media overlays.

## Performance

Reserve media dimensions; prioritize only true LCP; responsive AVIF/WebP/JPEG; lazy-load below fold; poster-gate video/social; no visual dependency required for comprehension.

