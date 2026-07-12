# Homepage Architecture

`src/app/page.tsx` owns static homepage metadata and renders `features/home/HomePage`. The feature contains typed content, local media placeholders, shared CSS and grouped section-component modules:

- `HeroAndDiscovery`: hero, trust strip, collections and product shells.
- `StoryAndTrust`: manufacturing, workshop/artisan, purity and packaging.
- `ConversionAndEditorial`: custom orders, wholesale, review placeholders, social/video slots, journal and FAQ.

Fourteen semantic homepage sections hand off to the Phase 3C footer as the fifteenth blueprint region. The page has one H1. Shared public shell, ProductCard shell and Accordion primitives are reused. Product-card interactivity remains local UI state only; no persistence or network behavior exists.

Server Components are the default. Existing client boundaries are limited to shared navigation, accordion and product-shell UI controls.

