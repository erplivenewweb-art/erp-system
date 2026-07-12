# Testing and Build

Final results from `storefront/` on 2026-07-13:

| Gate | Result |
|---|---|
| Token generation/validation | Pass — 128 tokens |
| Boundary guard | Pass — 151 source files |
| Style guard | Pass |
| Lint | Pass |
| Typecheck | Pass |
| Tests | Pass — 13 files, 78 tests |
| Production build | Pass — 47 static/SSG pages |
| npm audit | Pass — 0 vulnerabilities |

Tests cover landing, FAQ, registration, login, dashboard/navigation, quotation, bulk table, catalogue price safety, KYC, support, metadata and landing/dashboard axe.

Build sizes: `.next/static` 790,087 bytes; `.next/server` 15,414,325 bytes; `.next/standalone` 22,657,498 bytes. Phase 3G deltas: +5,089, +3,576,591 and +1,777,646 bytes. These directory totals include twelve new static routes and are not browser transfer sizes.
