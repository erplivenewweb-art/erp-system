# Authentication Wireframe

## Purpose

Enable secure customer/dealer sign-in and recovery.

## Business goal

Restore access with minimal abandonment.

## User goal

Sign in or recover safely.

## Calls to action

- Primary: Continue securely
- Secondary: Reset password

## Desktop layout

12-column composition: Realm context → Credentials/passkey future → Recovery → Privacy → Support; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Realm context → Credentials/passkey future → Recovery then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Realm context → Credentials/passkey future → Recovery → Privacy → Support; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ AUTHENTICATION                                         │
├──────────────────────────────────────────────────────────┤
│ Realm context                                          │
│ Credentials/passkey future                             │
│ Recovery                                               │
│ Privacy                                                │
│ Support                                                │
├──────────────────────────────────────────────────────────┤
│ [Continue securely]  [Reset password]│
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

- `authentication_view`
- `authentication_primary_cta`
- `authentication_secondary_cta`
- `authentication_error`

## Future app mapping

Maps to a channel-neutral Authentication screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

