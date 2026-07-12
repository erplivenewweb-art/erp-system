# Checkout Wireframe

## Purpose

Collect delivery and payment intent with minimal uncertainty.

## Business goal

Create a valid staged retail order in future implementation.

## User goal

Complete purchase securely without surprises.

## Calls to action

- Primary: Place order
- Secondary: Return to cart

## Desktop layout

12-column composition: Progress → Contact → Address → Delivery → Payment → Review → Consent → Order summary; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Progress → Contact → Address → Delivery then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Progress → Contact → Address → Delivery → Payment → Review → Consent → Order summary; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ CHECKOUT                                               │
├──────────────────────────────────────────────────────────┤
│ Progress                                               │
│ Contact                                                │
│ Address                                                │
│ Delivery                                               │
│ Payment                                                │
│ Review                                                 │
│ Consent                                                │
│ Order summary                                          │
├──────────────────────────────────────────────────────────┤
│ [Place order]  [Return to cart]│
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

- `checkout_view`
- `checkout_primary_cta`
- `checkout_secondary_cta`
- `checkout_error`

## Future app mapping

Maps to a channel-neutral Checkout screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

