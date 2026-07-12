# Dealer Registration Wireframe

## Purpose

Create and submit a dealer application.

## Business goal

Acquire qualified wholesale partners with complete evidence.

## User goal

Apply with clarity and save progress.

## Calls to action

- Primary: Save and continue
- Secondary: Save for later

## Desktop layout

12-column composition: Benefits → Eligibility → Stepper → Account → Business → GST reference → Evidence reference → Review; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Benefits → Eligibility → Stepper → Account then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Benefits → Eligibility → Stepper → Account → Business → GST reference → Evidence reference → Review; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ DEALER REGISTRATION                                    │
├──────────────────────────────────────────────────────────┤
│ Benefits                                               │
│ Eligibility                                            │
│ Stepper                                                │
│ Account                                                │
│ Business                                               │
│ GST reference                                          │
│ Evidence reference                                     │
│ Review                                                 │
├──────────────────────────────────────────────────────────┤
│ [Save and continue]  [Save for later]│
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

- `dealer-registration_view`
- `dealer-registration_primary_cta`
- `dealer-registration_secondary_cta`
- `dealer-registration_error`

## Future app mapping

Maps to a channel-neutral Dealer Registration screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

