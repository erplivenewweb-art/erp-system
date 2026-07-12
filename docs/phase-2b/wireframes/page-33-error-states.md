# Error States Wireframe

## Purpose

Explain safe failures and preserve progress.

## Business goal

Support recovery without leaking internals.

## User goal

Retry or get help without losing work.

## Calls to action

- Primary: Try again
- Secondary: Contact support

## Desktop layout

12-column composition: Safe message → Preserved content → Recovery → Correlation reference → Support; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Safe message → Preserved content → Recovery then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Safe message → Preserved content → Recovery → Correlation reference → Support; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ ERROR STATES                                           │
├──────────────────────────────────────────────────────────┤
│ Safe message                                           │
│ Preserved content                                      │
│ Recovery                                               │
│ Correlation reference                                  │
│ Support                                                │
├──────────────────────────────────────────────────────────┤
│ [Try again]  [Contact support]│
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

- `error-states_view`
- `error-states_primary_cta`
- `error-states_secondary_cta`
- `error-states_error`

## Future app mapping

Maps to a channel-neutral Error States screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

