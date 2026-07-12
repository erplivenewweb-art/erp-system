# Cart Wireframe

## Purpose

Review selected items before checkout preview.

## Business goal

Reduce abandonment and invalid orders.

## User goal

Edit quantity and understand current estimate.

## Calls to action

- Primary: Review checkout
- Secondary: Continue shopping

## Desktop layout

12-column composition: Items → Quantity → Freshness → Summary → Delivery/returns trust; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Items → Quantity → Freshness then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Items → Quantity → Freshness → Summary → Delivery/returns trust; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ CART                                                   │
├──────────────────────────────────────────────────────────┤
│ Items                                                  │
│ Quantity                                               │
│ Freshness                                              │
│ Summary                                                │
│ Delivery/returns trust                                 │
├──────────────────────────────────────────────────────────┤
│ [Review checkout]  [Continue shopping]│
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

- `cart_view`
- `cart_primary_cta`
- `cart_secondary_cta`
- `cart_error`

## Future app mapping

Maps to a channel-neutral Cart screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

