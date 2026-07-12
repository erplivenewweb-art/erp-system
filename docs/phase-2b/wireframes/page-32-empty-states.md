# Empty States Wireframe

## Purpose

Explain why a valid view has no content.

## Business goal

Guide a useful next step.

## User goal

Understand the empty condition and continue.

## Calls to action

- Primary: Explore products
- Secondary: Adjust filters

## Desktop layout

12-column composition: Context illustration optional → Heading → Reason → Primary action → Secondary action; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Context illustration optional → Heading → Reason then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Context illustration optional → Heading → Reason → Primary action → Secondary action; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ EMPTY STATES                                           │
├──────────────────────────────────────────────────────────┤
│ Context illustration optional                          │
│ Heading                                                │
│ Reason                                                 │
│ Primary action                                         │
│ Secondary action                                       │
├──────────────────────────────────────────────────────────┤
│ [Explore products]  [Adjust filters]│
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

- `empty-states_view`
- `empty-states_primary_cta`
- `empty-states_secondary_cta`
- `empty-states_error`

## Future app mapping

Maps to a channel-neutral Empty States screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

