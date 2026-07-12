# Wholesale Landing Wireframe

## Purpose

Explain dealer value and application path publicly.

## Business goal

Acquire qualified dealer applicants.

## User goal

Understand eligibility, benefits and process.

## Calls to action

- Primary: Apply as dealer
- Secondary: Dealer sign in

## Desktop layout

12-column composition: Proposition → Range → Benefits → Process → Eligibility → FAQ → Support; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Proposition → Range → Benefits → Process then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Proposition → Range → Benefits → Process → Eligibility → FAQ → Support; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ WHOLESALE LANDING                                      │
├──────────────────────────────────────────────────────────┤
│ Proposition                                            │
│ Range                                                  │
│ Benefits                                               │
│ Process                                                │
│ Eligibility                                            │
│ FAQ                                                    │
│ Support                                                │
├──────────────────────────────────────────────────────────┤
│ [Apply as dealer]  [Dealer sign in]│
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

- `wholesale_view`
- `wholesale_primary_cta`
- `wholesale_secondary_cta`
- `wholesale_error`

## Future app mapping

Maps to a channel-neutral Wholesale Landing screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

