# Phase 3A — Isolated Storefront Scaffold

Phase 3A creates the first runtime only under `storefront/`. It is a minimal technical foundation, not the final website. Phase 3B is not started.

## Commands

Run from `storefront/`:

```powershell
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run tokens:validate
npm run boundaries:check
npm run build
npm run validate
npm start
```

The development smoke check used `node node_modules/next/dist/bin/next dev -p 3210`, verified HTTP 200/content, then stopped the process.

## Isolation

The storefront owns its package, lockfile, build, tests, config and token generation. It is not mounted by ERP Express, is outside the root service-worker scope, has no root package-script connection and changes no Railway/Nixpacks configuration. Browser code calls only future Commerce API audience paths.

Rollback: delete only `storefront/` and `docs/phase-3a/`.

