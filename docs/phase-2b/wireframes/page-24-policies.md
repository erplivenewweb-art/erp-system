# Policies Wireframe

## Purpose

Present stable, versioned service/legal information.

## Business goal

Set accurate expectations.

## User goal

Understand terms, delivery, returns, privacy or care.

## Calls to action

- Primary: Contact support
- Secondary: View related policy

## Desktop layout

12-column composition: Policy title → Effective date → Contents → Body → Related policies → Contact; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Policy title → Effective date → Contents then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Policy title → Effective date → Contents → Body → Related policies → Contact; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ POLICIES                                               │
├──────────────────────────────────────────────────────────┤
│ Policy title                                           │
│ Effective date                                         │
│ Contents                                               │
│ Body                                                   │
│ Related policies                                       │
│ Contact                                                │
├──────────────────────────────────────────────────────────┤
│ [Contact support]  [View related policy]│
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

- `policies_view`
- `policies_primary_cta`
- `policies_secondary_cta`
- `policies_error`

## Future app mapping

Maps to a channel-neutral Policies screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

