# Dealer Catalogue Wireframe

## Purpose

Support dense, entitlement-gated wholesale discovery.

## Business goal

Increase valid bulk-cart and quote activity.

## User goal

Find products, prices, MOQ and slabs efficiently.

## Calls to action

- Primary: Add bulk quantity
- Secondary: Request quote

## Desktop layout

12-column composition: Bulk search → Filters → List/grid toggle → Authorized prices → MOQ/slabs → Bulk cart tray; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Bulk search → Filters → List/grid toggle then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Bulk search → Filters → List/grid toggle → Authorized prices → MOQ/slabs → Bulk cart tray; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ DEALER CATALOGUE                                       │
├──────────────────────────────────────────────────────────┤
│ Bulk search                                            │
│ Filters                                                │
│ List/grid toggle                                       │
│ Authorized prices                                      │
│ MOQ/slabs                                              │
│ Bulk cart tray                                         │
├──────────────────────────────────────────────────────────┤
│ [Add bulk quantity]  [Request quote]│
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

- `dealer-catalogue_view`
- `dealer-catalogue_primary_cta`
- `dealer-catalogue_secondary_cta`
- `dealer-catalogue_error`

## Future app mapping

Maps to a channel-neutral Dealer Catalogue screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

