# Testing Strategy

Layers: unit (pure utilities/tokens/state); component (states/a11y/responsive); contract/schema; API client/retry/redaction; integration (features with mocks); visual regression (light/dark/themes/viewports); automated/manual accessibility; performance/Lighthouse/Web Vitals/bundles; E2E public/B2C/B2B; SEO rendered output; auth/session/CSRF; security negative cases.

Critical journeys: product discovery, cart/checkout failure recovery, customer orders/returns, dealer application/approval denial, wholesale gating, MOQ/quotes/revisions/acceptance, outages/stale states, CMS preview leakage. Test mobile/tablet/desktop, keyboard/screen readers and approved browsers.

Mock Commerce API from Phase 1D contracts with deterministic fixtures; no production data/DB. ERP regression remains a separate protected suite/fingerprint and storefront tests never start or mutate ERP. CI gates type/lint/unit/contract/a11y then integration/E2E/visual/performance.

