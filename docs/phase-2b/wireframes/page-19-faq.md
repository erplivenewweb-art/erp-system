# FAQ Wireframe

## Purpose

Resolve common objections accessibly.

## Business goal

Reduce friction and repetitive support.

## User goal

Get a clear current answer.

## Calls to action

- Primary: Open answer
- Secondary: Contact support

## Desktop layout

12-column composition: Search → Topic navigation → Accordions → Escalation; primary task remains above the first major scroll where appropriate.

## Tablet layout

8-column responsive reflow: Search → Topic navigation then stacked supporting regions; no desktop-only interaction.

## Mobile layout

4-column single-task sequence: Search → Topic navigation → Accordions → Escalation; 44px targets, safe-area spacing, no horizontal overflow.

## Structural wireframe

```text
┌──────────────────────────────────────────────────────────┐
│ FAQ                                                    │
├──────────────────────────────────────────────────────────┤
│ Search                                                 │
│ Topic navigation                                       │
│ Accordions                                             │
│ Escalation                                             │
├──────────────────────────────────────────────────────────┤
│ [Open answer]  [Contact support]│
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

- `faq_view`
- `faq_primary_cta`
- `faq_secondary_cta`
- `faq_error`

## Future app mapping

Maps to a channel-neutral FAQ screen/deep link using the same content priority, public IDs, states and accessibility semantics; native navigation replaces web chrome only.

