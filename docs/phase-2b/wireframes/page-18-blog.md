# Blog and Guides Wireframe

## Purpose

Deliver original educational and craft content.

## Business goal

Build authority and qualified discovery.

## User goal

Learn about craft, care and culture.

## Calls to action

- Primary: Read article
- Secondary: Explore products

## Desktop layout

12-column composition: Editorial hero → Topic filters → Featured article → Article grid → Newsletter; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Editorial hero → Topic filters → Featured article then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Editorial hero → Topic filters → Featured article → Article grid → Newsletter; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ BLOG AND GUIDES                                        │
├──────────────────────────────────────────────────────────┤
│ Editorial hero                                         │
│ Topic filters                                          │
│ Featured article                                       │
│ Article grid                                           │
│ Newsletter                                             │
├──────────────────────────────────────────────────────────┤
│ [Read article]  [Explore products]│
└──────────────────────────────────────────────────────────┘
```

## CMS editable areas

- Approved headings
- Editorial copy
- Published media
- SEO metadata
- CTA labels/destinations within allowlist

## SEO areas

- Title/meta
- Canonical/indexing policy
- H1/headings
- Breadcrumbs where hierarchical
- Structured data only when eligible and visible

## Accessibility notes

- WCAG 2.2 AA
- Logical heading/landmark and focus order
- Keyboard and screen-reader complete
- Visible 3:1 focus indicator
- Errors and state never color-only
- 200% zoom/reflow

## Performance notes

- Stable media ratios and reserved space
- Prioritize only true LCP asset
- Lazy-load below-fold media
- Progressive content without blocking primary task
- Third parties poster/consent gated

## Animation notes

- Purposeful 160–240ms feedback
- No essential animation
- Reduced-motion static equivalent
- No scroll hijacking or autoplay with sound

## Analytics events

- `blog_view`
- `blog_primary_cta`
- `blog_secondary_cta`
- `blog_error`

## Future app mapping

Maps to a channel-neutral Blog and Guides screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

