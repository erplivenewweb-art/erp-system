# Profile Wireframe

## Purpose

Let users manage permitted identity and preferences.

## Business goal

Improve account accuracy and consent control.

## User goal

Update personal information safely.

## Calls to action

- Primary: Save changes
- Secondary: Cancel

## Desktop layout

12-column composition: Identity fields → Contact verification → Preferences → Consent → Account closure; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Identity fields → Contact verification → Preferences then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Identity fields → Contact verification → Preferences → Consent → Account closure; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ PROFILE                                                │
├──────────────────────────────────────────────────────────┤
│ Identity fields                                        │
│ Contact verification                                   │
│ Preferences                                            │
│ Consent                                                │
│ Account closure                                        │
├──────────────────────────────────────────────────────────┤
│ [Save changes]  [Cancel]│
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

- `profile_view`
- `profile_primary_cta`
- `profile_secondary_cta`
- `profile_error`

## Future app mapping

Maps to a channel-neutral Profile screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

