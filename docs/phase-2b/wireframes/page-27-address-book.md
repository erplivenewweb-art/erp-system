# Address Book Wireframe

## Purpose

Manage reusable delivery addresses.

## Business goal

Reduce checkout effort and address errors.

## User goal

Add, edit and choose addresses.

## Calls to action

- Primary: Add address
- Secondary: Edit address

## Desktop layout

12-column composition: Address cards → Default state → Validation → Archive; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Address cards → Default state then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Address cards → Default state → Validation → Archive; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ ADDRESS BOOK                                           │
├──────────────────────────────────────────────────────────┤
│ Address cards                                          │
│ Default state                                          │
│ Validation                                             │
│ Archive                                                │
├──────────────────────────────────────────────────────────┤
│ [Add address]  [Edit address]│
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

- `address-book_view`
- `address-book_primary_cta`
- `address-book_secondary_cta`
- `address-book_error`

## Future app mapping

Maps to a channel-neutral Address Book screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

