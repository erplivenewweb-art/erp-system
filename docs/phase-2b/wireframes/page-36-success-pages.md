# Success Pages Wireframe

## Purpose

Confirm completed user intent and clarify next steps.

## Business goal

Reduce duplicate submission and support.

## User goal

Know what succeeded and what happens next.

## Calls to action

- Primary: View details
- Secondary: Continue

## Desktop layout

12-column composition: Confirmation → Safe reference → Summary → Next steps → Support → Related action; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Confirmation → Safe reference → Summary then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Confirmation → Safe reference → Summary → Next steps → Support → Related action; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ SUCCESS PAGES                                          │
├──────────────────────────────────────────────────────────┤
│ Confirmation                                           │
│ Safe reference                                         │
│ Summary                                                │
│ Next steps                                             │
│ Support                                                │
│ Related action                                         │
├──────────────────────────────────────────────────────────┤
│ [View details]  [Continue]│
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

- `success-pages_view`
- `success-pages_primary_cta`
- `success-pages_secondary_cta`
- `success-pages_error`

## Future app mapping

Maps to a channel-neutral Success Pages screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

