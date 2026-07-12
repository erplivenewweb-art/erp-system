# Phase 3B — Design Token Integration and Shared UI Foundation

Phase 3B extends only the isolated `storefront/` and this directory. It implements shared, business-neutral UI foundations and a noindex `/design-system` showcase. Phase 3C is not started.

Commands from `storefront/`:

```powershell
npm install
npm run tokens:generate
npm run tokens:validate
npm run boundaries:check
npm run styles:check
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

The showcase is synthetic, makes no API calls, is absent from public navigation and must be disabled or access-protected before a production launch decision.

