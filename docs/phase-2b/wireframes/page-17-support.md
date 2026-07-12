# Support Wireframe

## Purpose

Route questions to the right self-service or human channel.

## Business goal

Resolve issues efficiently.

## User goal

Find an answer or contact support.

## Calls to action

- Primary: Search help
- Secondary: Contact support

## Desktop layout

12-column composition: Help search → Topics → Order help → FAQ → Contact channels → Hours; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Help search → Topics → Order help then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Help search → Topics → Order help → FAQ → Contact channels → Hours; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ SUPPORT                                                │
├──────────────────────────────────────────────────────────┤
│ Help search                                            │
│ Topics                                                 │
│ Order help                                             │
│ FAQ                                                    │
│ Contact channels                                       │
│ Hours                                                  │
├──────────────────────────────────────────────────────────┤
│ [Search help]  [Contact support]│
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

- `support_view`
- `support_primary_cta`
- `support_secondary_cta`
- `support_error`

## Future app mapping

Maps to a channel-neutral Support screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

