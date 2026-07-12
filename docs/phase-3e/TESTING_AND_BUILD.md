# Testing and Build

All commands ran from `storefront/` on 2026-07-12.

| Gate | Result |
|---|---|
| `npm run tokens:generate` | Pass — 128 tokens generated |
| `npm run tokens:validate` | Pass — 128 unique tokens |
| `npm run boundaries:check` | Pass — 86 source files |
| `npm run styles:check` | Pass |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass — 10 files, 44 tests |
| `npm run build` | Pass — 23 static/SSG pages |
| `npm audit` | Pass — 0 vulnerabilities |

Tests cover shop, collection, category, search, comparison, product page, gallery interaction, breadcrumb, filters, metadata, single-H1 rules, synthetic content, no numeric pricing, CTA names, disclosure semantics and axe checks.

Generated build sizes: `.next/static` 763,172 bytes; `.next/server` 8,287,003 bytes; `.next/standalone` 19,109,356 bytes. Against Phase 3D: static +26,368 bytes, server +3,649,741 bytes, standalone +2,497,560 bytes. These are generated directory totals, not browser-transfer sizes; the server/standalone increase includes 15 generated static parameterized catalogue pages.
