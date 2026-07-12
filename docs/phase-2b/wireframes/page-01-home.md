# Home Wireframe

## Purpose

Introduce the manufacturer-led luxury brand and route visitors to products, craft, custom and wholesale.

## Business goal

Increase qualified product discovery and trust.

## User goal

Understand the brand and choose a relevant path.

## Calls to action

- Primary: Explore Silver Sankha
- Secondary: Discover our craft

## Desktop layout

12-column composition: Hero → Trust proof → Collections → Featured products → Manufacturing → Reviews → Wholesale → Journal → Footer; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Hero → Trust proof → Collections → Featured products → Manufacturing then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Hero → Trust proof → Collections → Featured products → Manufacturing → Reviews → Wholesale → Journal → Footer; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ HOME                                                   │
├──────────────────────────────────────────────────────────┤
│ Hero                                                   │
│ Trust proof                                            │
│ Collections                                            │
│ Featured products                                      │
│ Manufacturing                                          │
│ Reviews                                                │
│ Wholesale                                              │
│ Journal                                                │
│ Footer                                                 │
├──────────────────────────────────────────────────────────┤
│ [Explore Silver Sankha]  [Discover our craft]│
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

- `home_view`
- `home_primary_cta`
- `home_secondary_cta`
- `home_error`

## Future app mapping

Maps to a channel-neutral Home screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

