# Order Tracking Wireframe

## Purpose

Communicate shipment progress safely.

## Business goal

Reduce uncertainty and support load.

## User goal

Know current status, next step and help options.

## Calls to action

- Primary: View order details
- Secondary: Contact support

## Desktop layout

12-column composition: Reference lookup or auth → Timeline → Package cards → Delivery estimate → Support; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Reference lookup or auth → Timeline → Package cards then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Reference lookup or auth → Timeline → Package cards → Delivery estimate → Support; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ ORDER TRACKING                                         │
├──────────────────────────────────────────────────────────┤
│ Reference lookup or auth                               │
│ Timeline                                               │
│ Package cards                                          │
│ Delivery estimate                                      │
│ Support                                                │
├──────────────────────────────────────────────────────────┤
│ [View order details]  [Contact support]│
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

- `order-tracking_view`
- `order-tracking_primary_cta`
- `order-tracking_secondary_cta`
- `order-tracking_error`

## Future app mapping

Maps to a channel-neutral Order Tracking screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

