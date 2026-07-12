# Phase 3 Implementation Plan

Phase 3 begins only after explicit approval. Every subphase changes only the isolated `storefront/` project and approved commerce-only packages/tests. Existing ERP/root files, routes, packages, service worker, deployment and Phase documentation are prohibited throughout.

## Phase 3A — Isolated Storefront Scaffold

- Scope: create separate pinned Next.js/React/TypeScript project, quality tooling, empty route groups and standalone health.
- Files allowed: new `storefront/`, commerce-only CI config if separately approved.
- Files prohibited: all ERP/root runtime/package/deployment files; commerce feature implementation.
- Dependencies: approved framework/hosting/version decisions.
- Deliverables: bootable empty shell, isolation checks, no ERP imports/routes.
- Tests: build/type/lint, health, route smoke, dependency/license/security baseline.
- Exit gate: independent local/preview deploy and zero Phase 1A fingerprint drift.
- Rollback: delete only new scaffold/deployment resources.
- ERP regression check: protected hashes, route/table inventories.

## Phase 3B — Design Tokens and Shared UI Primitives

- Scope: canonical token generation, reset/globals and accessible primitives.
- Files allowed: storefront token/style/component/test areas; commerce token package.
- Files prohibited: pages/domain/API mutations.
- Dependencies: 3A, approved token/font decisions.
- Deliverables: light/dark base, button/input/dialog/table etc. in catalogue.
- Tests: token drift/contrast, component/a11y/visual/unit.
- Exit gate: all primitive states/viewports/themes pass.
- Rollback: token/UI commits/package only.
- ERP regression check: fingerprints unchanged.

## Phase 3C — Public Layout and Navigation

- Scope: public shell, header/footer/mega/mobile nav, error/loading/404.
- Files allowed: public layouts/navigation/shared shell.
- Files prohibited: ERP calls, checkout/account/dealer business UI.
- Dependencies: 3B, final IA/content fixtures.
- Deliverables: responsive semantic public shell.
- Tests: keyboard/screen reader, routes, visual, bundle/performance.
- Exit gate: WCAG navigation and mobile/tablet/desktop acceptance.
- Rollback: public-shell boundary.
- ERP regression check: fingerprints unchanged.

## Phase 3D — Homepage Static Implementation

- Scope: typed fixture/CMS-module homepage with Phase 2C visuals.
- Files allowed: home sections, fixture/mock adapter, media references.
- Files prohibited: live CMS/API/order behavior.
- Dependencies: 3C, approved media/content.
- Deliverables: responsive static/ISR-ready homepage.
- Tests: visual/a11y/SEO/performance/CMS module contract.
- Exit gate: LCP/CLS/budgets and content approval.
- Rollback: homepage feature only.
- ERP regression check: fingerprints unchanged.

## Phase 3E — Catalogue, Collection and Product Screens

- Scope: public read-only catalogue UI with mocked/approved Commerce API client.
- Files allowed: catalogue features/routes/contracts/tests.
- Files prohibited: direct ERP/internal calls, cart mutations.
- Dependencies: 3D, Phase 1B/1D contracts.
- Deliverables: listing, facets, product gallery/facts/safe availability/retail quote display.
- Tests: contract, SEO, stale/outage, visual/a11y/performance.
- Exit gate: sensitive-field and ERP-route negative tests pass.
- Rollback: catalogue feature/routes.
- ERP regression check: fingerprints unchanged.

## Phase 3F — Search, Wishlist and Cart UI

- Scope: client interactions using mocks or approved Commerce endpoints.
- Files allowed: search/wishlist/cart state/features/tests.
- Files prohibited: checkout/order/payment/ERP writes.
- Dependencies: 3E and auth/session foundation approval.
- Deliverables: URL search, wishlist, versioned cart, validation states.
- Tests: optimistic rollback, cross-tab, expiry/stale, a11y/E2E.
- Exit gate: no sensitive storage and reliable recovery.
- Rollback: three feature boundaries.
- ERP regression check: fingerprints unchanged.

## Phase 3G — Customer Account UI

- Scope: customer auth/profile/address/orders/returns/reviews/notifications UI.
- Files allowed: customer routes/features/client contracts/tests.
- Files prohibited: dealer/admin/ERP auth and real payment.
- Dependencies: auth provider and customer APIs approved.
- Deliverables: protected account shell and self-service screens.
- Tests: session/CSRF/BOLA negative, E2E/a11y/outage.
- Exit gate: trust-domain security approval.
- Rollback: customer route group.
- ERP regression check: fingerprints unchanged.

## Phase 3H — B2B Dealer UI

- Scope: application/status/dashboard/catalogue/bulk cart/quotations/orders/credit display.
- Files allowed: dealer applicant/approved route groups/features/tests.
- Files prohibited: public wholesale leakage, ERP employee auth/direct writes.
- Dependencies: dealer auth/approval/pricing APIs and legal/credit policy.
- Deliverables: entitlement-gated dealer journeys.
- Tests: approval/suspension, company isolation, MOQ/quote revisions, leakage/a11y.
- Exit gate: dealer/security/finance review and negative authorization suite.
- Rollback: dealer route groups.
- ERP regression check: fingerprints unchanged.

## Phase 3I — CMS Preview/UI Integration Shell

- Scope: storefront preview consumer plus separate-admin boundary stub/contract.
- Files allowed: preview verifier/banner/module registry/tests; no admin app unless separately approved.
- Files prohibited: ERP fact editing, arbitrary code modules, public draft caching.
- Dependencies: CMS/provider/preview security decisions.
- Deliverables: signed noindex preview, audience/device/theme rendering.
- Tests: token expiry, cache bypass, wholesale leakage, module fallback/a11y.
- Exit gate: CMS/security/content owner approval.
- Rollback: preview integration only.
- ERP regression check: fingerprints unchanged.

## Phase 3J — Accessibility, Performance and Visual Regression Hardening

- Scope: cross-route remediation and release qualification; no new product scope.
- Files allowed: storefront fixes/tests/budgets/documented exceptions.
- Files prohibited: architectural shortcuts, ERP modifications.
- Dependencies: 3A–3I applicable features.
- Deliverables: WCAG, Web Vitals/bundles, visual baselines, cross-browser/device qualification.
- Tests: complete unit→E2E/security/a11y/performance/SEO matrix.
- Exit gate: all budgets/gates pass or approved time-boxed exception with owner.
- Rollback: atomic fixes/baseline updates.
- ERP regression check: final Phase 1A–2D integrity verification.

