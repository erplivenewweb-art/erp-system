# Wishlist Wireframe

## Purpose

Hold considered products for later.

## Business goal

Return users to product/cart decisions.

## User goal

Review, compare and move saved items.

## Calls to action

- Primary: Move to cart
- Secondary: Remove item

## Desktop layout

12-column composition: Saved products → Availability/price freshness → Recommendations; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Saved products → Availability/price freshness then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Saved products → Availability/price freshness → Recommendations; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ WISHLIST                                               │
├──────────────────────────────────────────────────────────┤
│ Saved products                                         │
│ Availability/price freshness                           │
│ Recommendations                                        │
├──────────────────────────────────────────────────────────┤
│ [Move to cart]  [Remove item]│
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

- `wishlist_view`
- `wishlist_primary_cta`
- `wishlist_secondary_cta`
- `wishlist_error`

## Future app mapping

Maps to a channel-neutral Wishlist screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

