# Category Wireframe

## Purpose

Help users browse a stable product taxonomy.

## Business goal

Move category intent into product consideration.

## User goal

Compare relevant product types quickly.

## Calls to action

- Primary: View product
- Secondary: Adjust filters

## Desktop layout

12-column composition: Breadcrumb → Editorial intro → Filter/sort → Product grid → FAQ → Related categories; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Breadcrumb → Editorial intro → Filter/sort then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Breadcrumb → Editorial intro → Filter/sort → Product grid → FAQ → Related categories; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ CATEGORY                                               │
├──────────────────────────────────────────────────────────┤
│ Breadcrumb                                             │
│ Editorial intro                                        │
│ Filter/sort                                            │
│ Product grid                                           │
│ FAQ                                                    │
│ Related categories                                     │
├──────────────────────────────────────────────────────────┤
│ [View product]  [Adjust filters]│
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

- `category_view`
- `category_primary_cta`
- `category_secondary_cta`
- `category_error`

## Future app mapping

Maps to a channel-neutral Category screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

