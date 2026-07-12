# Search Wireframe

## Purpose

Turn explicit intent into relevant discovery.

## Business goal

Improve findability and product engagement.

## User goal

Find products quickly and recover from imperfect queries.

## Calls to action

- Primary: View result
- Secondary: Change filters

## Desktop layout

12-column composition: Search input → Suggestions → Result count → Filters → Sort → Product grid → Recovery; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Search input → Suggestions → Result count → Filters then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Search input → Suggestions → Result count → Filters → Sort → Product grid → Recovery; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ SEARCH                                                 │
├──────────────────────────────────────────────────────────┤
│ Search input                                           │
│ Suggestions                                            │
│ Result count                                           │
│ Filters                                                │
│ Sort                                                   │
│ Product grid                                           │
│ Recovery                                               │
├──────────────────────────────────────────────────────────┤
│ [View result]  [Change filters]│
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

- `search_view`
- `search_primary_cta`
- `search_secondary_cta`
- `search_error`

## Future app mapping

Maps to a channel-neutral Search screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

