# Quotation Wireframe

## Purpose

Make revisions, terms and acceptance understandable.

## Business goal

Convert agreed wholesale intent once and safely.

## User goal

Compare revisions and accept/reject confidently.

## Calls to action

- Primary: Accept quotation
- Secondary: Request revision

## Desktop layout

12-column composition: Status → Revision selector → Line snapshots → Terms → Messages → Approval action → History; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Status → Revision selector → Line snapshots → Terms then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Status → Revision selector → Line snapshots → Terms → Messages → Approval action → History; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ QUOTATION                                              │
├──────────────────────────────────────────────────────────┤
│ Status                                                 │
│ Revision selector                                      │
│ Line snapshots                                         │
│ Terms                                                  │
│ Messages                                               │
│ Approval action                                        │
│ History                                                │
├──────────────────────────────────────────────────────────┤
│ [Accept quotation]  [Request revision]│
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

- `quotation_view`
- `quotation_primary_cta`
- `quotation_secondary_cta`
- `quotation_error`

## Future app mapping

Maps to a channel-neutral Quotation screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

