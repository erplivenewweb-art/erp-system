# Testing and Build

All final commands ran after the responsive fix from `storefront/` on 2026-07-13.

| Gate | Result |
|---|---|
| Token generation | Pass — 128 tokens |
| Token validation | Pass |
| Boundary guard | Pass — 127 source files |
| Style guard | Pass |
| Lint | Pass |
| Typecheck | Pass |
| Tests | Pass — 12 files, 66 tests |
| Production build | Pass — 35 static/SSG pages |
| npm audit | Pass — 0 vulnerabilities |

Tests cover dashboard, full navigation, order list/detail/timeline, addresses, profile, security, notifications, empty states, private metadata and dashboard/profile axe checks.

Generated sizes: `.next/static` 784,998 bytes; `.next/server` 11,837,734 bytes; `.next/standalone` 20,879,852 bytes. Phase 3F deltas: +5,125, +2,045,208 and +1,019,154 bytes. These directory totals include seven generated account pages and are not transfer sizes.
