# Testing and Build

Final results from `storefront/` on 2026-07-13:

| Gate | Result |
|---|---|
| Token generation/validation | Pass — 128 tokens |
| Boundary guard | Pass — 178 source files |
| Style guard | Pass |
| Lint | Pass |
| Typecheck | Pass |
| Tests | Pass — 14 files, 90 tests |
| Production build | Pass — 61 static/SSG pages |
| npm audit | Pass — 0 vulnerabilities |

Tests cover dashboard/navigation, homepage, products, collections, categories, banners, media, blog, SEO, navigation groups, theme, private metadata and dashboard/homepage axe.

Build sizes: `.next/static` 794,652 bytes; `.next/server` 19,520,886 bytes; `.next/standalone` 24,737,984 bytes. Phase 3H deltas: +4,565, +4,106,561 and +2,080,486 bytes. These generated totals include 14 new static routes and are not transfer sizes.
