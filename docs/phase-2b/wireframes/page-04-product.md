# Product Wireframe

## Purpose

Enable confident evaluation of one design and variant.

## Business goal

Drive qualified cart, wishlist, custom or dealer quote intent.

## User goal

Judge beauty, facts, fit, price, availability and service.

## Calls to action

- Primary: Add to cart
- Secondary: Save or enquire

## Desktop layout

12-column composition: Breadcrumb → Gallery → Identity/facts → Price/availability → Options → Delivery/returns → Craft → Reviews → FAQ → Related; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Breadcrumb → Gallery → Identity/facts → Price/availability → Options then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Breadcrumb → Gallery → Identity/facts → Price/availability → Options → Delivery/returns → Craft → Reviews → FAQ → Related; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ PRODUCT                                                │
├──────────────────────────────────────────────────────────┤
│ Breadcrumb                                             │
│ Gallery                                                │
│ Identity/facts                                         │
│ Price/availability                                     │
│ Options                                                │
│ Delivery/returns                                       │
│ Craft                                                  │
│ Reviews                                                │
│ FAQ                                                    │
│ Related                                                │
├──────────────────────────────────────────────────────────┤
│ [Add to cart]  [Save or enquire]│
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

- `product_view`
- `product_primary_cta`
- `product_secondary_cta`
- `product_error`

## Future app mapping

Maps to a channel-neutral Product screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

