# Maintenance Mode Wireframe

## Purpose

Communicate planned/unplanned unavailability.

## Business goal

Preserve trust during downtime.

## User goal

Know impact and when/how to return.

## Calls to action

- Primary: Check status
- Secondary: Contact support

## Desktop layout

12-column composition: Brand-safe notice → Affected services → Time/status → Alternative channels; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Brand-safe notice → Affected services then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Brand-safe notice → Affected services → Time/status → Alternative channels; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ MAINTENANCE MODE                                       │
├──────────────────────────────────────────────────────────┤
│ Brand-safe notice                                      │
│ Affected services                                      │
│ Time/status                                            │
│ Alternative channels                                   │
├──────────────────────────────────────────────────────────┤
│ [Check status]  [Contact support]│
└──────────────────────────────────────────────────────────┘
```

## CMS editable areas

- Approved headings
- Editorial copy
- Published media
- SEO metadata
- CTA labels/destinations within allowlist

## SEO areas

- Title/meta
- Canonical/indexing policy
- H1/headings
- Breadcrumbs where hierarchical
- Structured data only when eligible and visible

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

- `maintenance-mode_view`
- `maintenance-mode_primary_cta`
- `maintenance-mode_secondary_cta`
- `maintenance-mode_error`

## Future app mapping

Maps to a channel-neutral Maintenance Mode screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

