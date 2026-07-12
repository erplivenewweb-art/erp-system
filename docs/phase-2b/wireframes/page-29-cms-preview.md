# CMS Preview Wireframe

## Purpose

Preview content across audiences and devices before publication.

## Business goal

Prevent broken, inaccessible or leaked content.

## User goal

Verify layout, visibility, SEO and schedule.

## Calls to action

- Primary: Approve for publishing
- Secondary: Return to edit

## Desktop layout

12-column composition: Device switcher → Locale → Audience → Schedule → Page preview → Accessibility/SEO checks → Version diff; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Device switcher → Locale → Audience → Schedule then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Device switcher → Locale → Audience → Schedule → Page preview → Accessibility/SEO checks → Version diff; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ CMS PREVIEW                                            │
├──────────────────────────────────────────────────────────┤
│ Device switcher                                        │
│ Locale                                                 │
│ Audience                                               │
│ Schedule                                               │
│ Page preview                                           │
│ Accessibility/SEO checks                               │
│ Version diff                                           │
├──────────────────────────────────────────────────────────┤
│ [Approve for publishing]  [Return to edit]│
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

- `cms-preview_view`
- `cms-preview_primary_cta`
- `cms-preview_secondary_cta`
- `cms-preview_error`

## Future app mapping

Maps to a channel-neutral CMS Preview screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

