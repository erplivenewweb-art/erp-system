# Returns and Refunds Wireframe

## Purpose

Guide an eligible request without promising approval.

## Business goal

Capture complete support intent safely.

## User goal

Understand eligibility and submit a request.

## Calls to action

- Primary: Start request
- Secondary: View policy

## Desktop layout

12-column composition: Eligibility → Order/item selection → Reason → Evidence guidance → Resolution preference → Confirmation; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Eligibility → Order/item selection → Reason then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Eligibility → Order/item selection → Reason → Evidence guidance → Resolution preference → Confirmation; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ RETURNS AND REFUNDS                                    │
├──────────────────────────────────────────────────────────┤
│ Eligibility                                            │
│ Order/item selection                                   │
│ Reason                                                 │
│ Evidence guidance                                      │
│ Resolution preference                                  │
│ Confirmation                                           │
├──────────────────────────────────────────────────────────┤
│ [Start request]  [View policy]│
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

- `returns_view`
- `returns_primary_cta`
- `returns_secondary_cta`
- `returns_error`

## Future app mapping

Maps to a channel-neutral Returns and Refunds screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

