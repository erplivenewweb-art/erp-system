# Contact Wireframe

## Purpose

Offer approved communication choices.

## Business goal

Create qualified, routable enquiries.

## User goal

Reach the correct team with expectations.

## Calls to action

- Primary: Send enquiry
- Secondary: Open approved WhatsApp

## Desktop layout

12-column composition: Contact reasons → Form → Channels → Hours → Privacy note → Location-safe content; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Contact reasons → Form → Channels then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Contact reasons → Form → Channels → Hours → Privacy note → Location-safe content; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ CONTACT                                                │
├──────────────────────────────────────────────────────────┤
│ Contact reasons                                        │
│ Form                                                   │
│ Channels                                               │
│ Hours                                                  │
│ Privacy note                                           │
│ Location-safe content                                  │
├──────────────────────────────────────────────────────────┤
│ [Send enquiry]  [Open approved WhatsApp]│
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

- `contact_view`
- `contact_primary_cta`
- `contact_secondary_cta`
- `contact_error`

## Future app mapping

Maps to a channel-neutral Contact screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

