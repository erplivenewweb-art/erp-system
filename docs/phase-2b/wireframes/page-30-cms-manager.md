# CMS Manager Wireframe

## Purpose

Organize content and publishing work.

## Business goal

Improve safe editorial throughput.

## User goal

Find drafts, approvals, schedules and issues.

## Calls to action

- Primary: Create content
- Secondary: Review queue

## Desktop layout

12-column composition: Navigation → Content inventory → Status filters → Calendar → Approval queue → Alerts; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Navigation → Content inventory → Status filters then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Navigation → Content inventory → Status filters → Calendar → Approval queue → Alerts; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ CMS MANAGER                                            │
├──────────────────────────────────────────────────────────┤
│ Navigation                                             │
│ Content inventory                                      │
│ Status filters                                         │
│ Calendar                                               │
│ Approval queue                                         │
│ Alerts                                                 │
├──────────────────────────────────────────────────────────┤
│ [Create content]  [Review queue]│
└──────────────────────────────────────────────────────────┘
```

## CMS editable areas

- Labels/help content governed by system owner; previewed content remains versioned

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

- `cms-manager_view`
- `cms-manager_primary_cta`
- `cms-manager_secondary_cta`
- `cms-manager_error`

## Future app mapping

Maps to a channel-neutral CMS Manager screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

