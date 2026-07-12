# Customer Order Detail Wireframe

## Purpose

Explain one order and its immutable purchase details.

## Business goal

Reduce support contacts and enable allowed actions.

## User goal

Understand status, items, payment, shipment and policies.

## Calls to action

- Primary: Track order
- Secondary: Request support

## Desktop layout

12-column composition: Status timeline → Items snapshot → Address → Price/tax snapshot → Payment state → Shipment → Actions; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Status timeline → Items snapshot → Address → Price/tax snapshot then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Status timeline → Items snapshot → Address → Price/tax snapshot → Payment state → Shipment → Actions; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ CUSTOMER ORDER DETAIL                                  │
├──────────────────────────────────────────────────────────┤
│ Status timeline                                        │
│ Items snapshot                                         │
│ Address                                                │
│ Price/tax snapshot                                     │
│ Payment state                                          │
│ Shipment                                               │
│ Actions                                                │
├──────────────────────────────────────────────────────────┤
│ [Track order]  [Request support]│
└──────────────────────────────────────────────────────────┘
```

## CMS editable areas

- Approved help text and empty-state copy only; transactional/user data is not CMS content

## SEO areas

- Noindex/private; semantic headings and stable accessible title

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

- `customer-order-detail_view`
- `customer-order-detail_primary_cta`
- `customer-order-detail_secondary_cta`
- `customer-order-detail_error`

## Future app mapping

Maps to a channel-neutral Customer Order Detail screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

