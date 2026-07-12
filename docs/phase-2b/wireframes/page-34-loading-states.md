# Loading States Wireframe

## Purpose

Provide stable feedback while content is fetched.

## Business goal

Protect perceived speed and prevent duplicate actions.

## User goal

Know progress without distraction.

## Calls to action

- Primary: Cancel when meaningful
- Secondary: None

## Desktop layout

12-column composition: Stable skeleton → Progress label → Loaded regions → Timeout recovery; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Stable skeleton → Progress label then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Stable skeleton → Progress label → Loaded regions → Timeout recovery; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ LOADING STATES                                         │
├──────────────────────────────────────────────────────────┤
│ Stable skeleton                                        │
│ Progress label                                         │
│ Loaded regions                                         │
│ Timeout recovery                                       │
├──────────────────────────────────────────────────────────┤
│ [Cancel when meaningful]  │
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

- `loading-states_view`
- `loading-states_primary_cta`
- `loading-states_secondary_cta`
- `loading-states_error`

## Future app mapping

Maps to a channel-neutral Loading States screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

