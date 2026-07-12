# Testing and Build

All commands ran from `storefront/` on 2026-07-13.

| Gate | Result |
|---|---|
| Token generation | Pass — 128 tokens |
| Token validation | Pass — 128 unique tokens |
| Boundary guard | Pass — 105 source files |
| Style guard | Pass |
| Lint | Pass |
| Typecheck | Pass |
| Tests | Pass — 11 files, 55 tests |
| Production build | Pass — 28 static/SSG pages |
| npm audit | Pass — 0 vulnerabilities |

Phase 3F tests cover cart items/actions, drawer open/close/focus restoration, wishlist cards and empty state, checkout labels/methods/consent, stepper current state, order summary, confirmation placeholders, no orders, metadata and cart/checkout axe checks.

Generated build sizes: `.next/static` 779,873 bytes; `.next/server` 9,792,526 bytes; `.next/standalone` 19,860,698 bytes. Phase 3E deltas are +16,701, +1,505,523 and +751,342 bytes. These totals include five additional pre-rendered routes and are not browser-transfer sizes.
