# Collection Wireframe

## Purpose

Present a curated design story and its products.

## Business goal

Build collection affinity and product views.

## User goal

Understand the collection and find a suitable design.

## Calls to action

- Primary: Explore collection
- Secondary: Read collection story

## Desktop layout

12-column composition: Breadcrumb → Collection hero → Story → Product grid → Craft note → Related collections; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Breadcrumb → Collection hero → Story then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Breadcrumb → Collection hero → Story → Product grid → Craft note → Related collections; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ COLLECTION                                             │
├──────────────────────────────────────────────────────────┤
│ Breadcrumb                                             │
│ Collection hero                                        │
│ Story                                                  │
│ Product grid                                           │
│ Craft note                                             │
│ Related collections                                    │
├──────────────────────────────────────────────────────────┤
│ [Explore collection]  [Read collection story]│
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

- `collection_view`
- `collection_primary_cta`
- `collection_secondary_cta`
- `collection_error`

## Future app mapping

Maps to a channel-neutral Collection screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

