# Dealer Dashboard Wireframe

## Purpose

Surface approved dealer priorities.

## Business goal

Accelerate wholesale ordering and quotation management.

## User goal

Act on quotes, orders, dispatches and terms.

## Calls to action

- Primary: Start bulk order
- Secondary: Request quotation

## Desktop layout

12-column composition: Status → KPIs → Quotes → Orders → Dispatches → Catalogue → Support; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Status → KPIs → Quotes → Orders then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Status → KPIs → Quotes → Orders → Dispatches → Catalogue → Support; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ DEALER DASHBOARD                                       │
├──────────────────────────────────────────────────────────┤
│ Status                                                 │
│ KPIs                                                   │
│ Quotes                                                 │
│ Orders                                                 │
│ Dispatches                                             │
│ Catalogue                                              │
│ Support                                                │
├──────────────────────────────────────────────────────────┤
│ [Start bulk order]  [Request quotation]│
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

- `dealer-dashboard_view`
- `dealer-dashboard_primary_cta`
- `dealer-dashboard_secondary_cta`
- `dealer-dashboard_error`

## Future app mapping

Maps to a channel-neutral Dealer Dashboard screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

