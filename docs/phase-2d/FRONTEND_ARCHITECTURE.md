# Frontend Architecture

Future repository boundaries are additive and isolated:

```text
existing ERP root/          protected, unchanged
storefront/                 separate Next.js project/deployment
commerce-api/               separate future service
erp-integration-api/        private future ERP-owned adapter
packages/                   commerce-only contracts/tokens/tooling
tests/                      cross-service non-production suites
docs/                       approved plans and product bible
```

The storefront has its own package manifest, lockfile, build output, service worker scope (only if PWA later), environment contract and deployment. It is not served by existing Express static routes, does not reuse the ERP root service worker, changes no root script and cannot call ERP routes.

Commerce Admin/CMS is a **separate future application**, not an admin route group inside the public storefront. It has a different workforce trust domain, release cadence, CSP, authorization, audit and bundle. Shared tokens/contracts may be published from commerce-only packages after approval.

Browser → Commerce API only. Commerce API → private ERP Integration API. No browser or storefront server receives ERP DB credentials or calls `/internal/v1/`.

