# Manufacturing Story Wireframe

## Purpose

Show craft evidence without exposing secrets.

## Business goal

Differentiate the brand through authentic making.

## User goal

Understand process, workshop and quality.

## Calls to action

- Primary: Explore products
- Secondary: Watch workshop film

## Desktop layout

12-column composition: Hero → Process overview → Workshop → Tools → Artisans → Quality → Purity promise → Video/transcript; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Hero → Process overview → Workshop → Tools then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Hero → Process overview → Workshop → Tools → Artisans → Quality → Purity promise → Video/transcript; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ MANUFACTURING STORY                                    │
├──────────────────────────────────────────────────────────┤
│ Hero                                                   │
│ Process overview                                       │
│ Workshop                                               │
│ Tools                                                  │
│ Artisans                                               │
│ Quality                                                │
│ Purity promise                                         │
│ Video/transcript                                       │
├──────────────────────────────────────────────────────────┤
│ [Explore products]  [Watch workshop film]│
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

- `manufacturing-story_view`
- `manufacturing-story_primary_cta`
- `manufacturing-story_secondary_cta`
- `manufacturing-story_error`

## Future app mapping

Maps to a channel-neutral Manufacturing Story screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

