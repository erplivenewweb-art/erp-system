# Customer Dashboard Wireframe

## Purpose

Provide a clear account home.

## Business goal

Increase self-service and repeat purchase.

## User goal

See orders, wishlist, returns and account tasks.

## Calls to action

- Primary: View orders
- Secondary: Continue shopping

## Desktop layout

12-column composition: Greeting → Active order → Quick links → Wishlist → Notifications → Support; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Greeting → Active order → Quick links then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Greeting → Active order → Quick links → Wishlist → Notifications → Support; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ CUSTOMER DASHBOARD                                     │
├──────────────────────────────────────────────────────────┤
│ Greeting                                               │
│ Active order                                           │
│ Quick links                                            │
│ Wishlist                                               │
│ Notifications                                          │
│ Support                                                │
├──────────────────────────────────────────────────────────┤
│ [View orders]  [Continue shopping]│
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

- `customer-dashboard_view`
- `customer-dashboard_primary_cta`
- `customer-dashboard_secondary_cta`
- `customer-dashboard_error`

## Future app mapping

Maps to a channel-neutral Customer Dashboard screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

