# About Wireframe

## Purpose

Explain the manufacturer-led brand and values.

## Business goal

Build preference and credibility.

## User goal

Know who makes the products and why.

## Calls to action

- Primary: Explore manufacturing
- Secondary: View collections

## Desktop layout

12-column composition: Brand story → Values → Milestones → People with consent → Trust → CTA; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Brand story → Values → Milestones then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Brand story → Values → Milestones → People with consent → Trust → CTA; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ ABOUT                                                  │
├──────────────────────────────────────────────────────────┤
│ Brand story                                            │
│ Values                                                 │
│ Milestones                                             │
│ People with consent                                    │
│ Trust                                                  │
│ CTA                                                    │
├──────────────────────────────────────────────────────────┤
│ [Explore manufacturing]  [View collections]│
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

- `about_view`
- `about_primary_cta`
- `about_secondary_cta`
- `about_error`

## Future app mapping

Maps to a channel-neutral About screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

