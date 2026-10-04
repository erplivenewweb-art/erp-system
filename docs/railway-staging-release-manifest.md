# Railway staging release manifest

Status: release preparation only. This document does not authorize deployment, database migration, credential rotation, or SuperAdmin bootstrap.

## Release entry points

- Runtime: `npm start` -> `js/backend/server.js`
- Explicit migration: `npm run db:migrate -- --confirm`
- Explicit SuperAdmin bootstrap: `npm run admin:bootstrap-superadmin -- --confirm`
- Health: `/health`
- Readiness: `/ready`
- Railway builder: Railpack
- Railway start command: `npm start`
- Railway health-check path: `/ready`

## Required checkout content

The staging checkout requires the repository's tracked ERP files plus the reviewed Phase 1-3B changes. In particular it requires:

- `package.json`, `package-lock.json`, `railway.json`, and `.env.example`
- `js/backend/server.js` and `js/backend/authMiddleware.js`
- `js/backend/startupSafety.js`
- `js/backend/colourPlant.js`
- `js/backend/privateCreateWebsiteSaleTransport.js`
- `js/backend/createWebsiteSale.js`
- `js/backend/stockCostAuthority.js`
- `js/backend/returnPolicy.js`
- all root ERP HTML pages referenced by the protected-page manifest in `server.js`, including `colour-plant.html`
- root `css/`, `js/`, image, manifest, and service-worker assets used by those pages
- `js/colour-plant-receipt-print.js`, which is loaded by `colour-plant.html`
- `migrations/20260818_colour_plant.up.sql` as migration history
- `scripts/backup-mysql.js` and `scripts/restore-mysql.js` for explicit administration only
- the guarded disposable/rehearsal and integration verification scripts named in `package.json`
- `tests/*.test.js` and their backend support modules for release verification

The following backend support modules are required by the release test suite even though they are not in the normal `server.js` runtime graph:

- `js/backend/createWebsiteSaleReferenceAuthority.js`
- `js/backend/createWebsiteSaleService.js`
- `js/backend/websiteSaleExecutionLifecycle.js`

## Runtime dependency inventory

The recursively resolved local CommonJS graph from `js/backend/server.js` is:

- `js/backend/server.js`
- `js/backend/authMiddleware.js`
- `js/backend/startupSafety.js`
- `js/backend/colourPlant.js`
- `js/backend/privateCreateWebsiteSaleTransport.js`
- `js/backend/createWebsiteSale.js`
- `js/backend/stockCostAuthority.js`
- `js/backend/returnPolicy.js`
- `js/colour-plant-receipt-print.js` (browser runtime loaded by `colour-plant.html`)

Optional runtime capability: SMTP. Core ERP startup and readiness do not require it when `SMTP_ENABLED=false`; OTP email flows are unavailable in that mode.

Test-only or verification-only content includes `tests/`, the three test-support backend modules listed above, and integration verification scripts. `reports/`, backup files, logs, cookies, dumps, and temporary release simulations are not runtime dependencies.

## Explicit exclusions

Never include the following in a Git or Railway release:

- `.env` or any environment-specific `.env.*` file (`.env.example` is intentionally retained)
- credentials, private keys, tokens, or database connection strings containing passwords
- `backups/`, `reports/`, `database-dumps/`, or `dumps/`
- `cookies.txt`, `*.log`, `current-start-error.txt`, or `start-error.txt`
- `*.dump`, `*.sql.gz`, or `*.sql.bz2`
- disposable-database data and `.phase3b-release-sim-*` directories

SQL migration source under `migrations/` is application source and must not be excluded by a blanket `*.sql` rule.

## Railway staging service design

- One public Node/Express web service, one replica, Railpack builder, `npm start`.
- Railway-provided `PORT`; public HTTPS domain used as the exact `APP_ORIGIN`.
- One Railway MySQL staging service reached through Railway private networking.
- No application volume is required. Set `BACKUP_AUTO_ENABLED=false`; use platform/database backups.
- Readiness uses `/ready`; liveness diagnostics use `/health`.
- The staging database is non-authoritative and must be identifiable as staging/disposable.

## Environment-variable matrix

| Variable | Requirement | Secret | Staging source/strategy |
| --- | --- | --- | --- |
| `NODE_ENV` | Required | No | Set to `production`. |
| `PORT` | Required at runtime | No | Railway supplies it. |
| `RAILWAY_ENVIRONMENT` | Railway-supplied | No | Railway supplies it. |
| `APP_ORIGIN` | Required | No | Exact Railway public HTTPS origin; no path. |
| `MYSQLHOST` | Required | No | Railway MySQL private host/reference. |
| `MYSQLPORT` | Required | No | Railway MySQL private port/reference. |
| `MYSQLUSER` | Required | Yes | Fresh Railway MySQL user/reference. |
| `MYSQLPASSWORD` | Required | Yes | Fresh Railway MySQL password/reference. |
| `MYSQLDATABASE` | Required | No | Clearly named staging database. |
| `JWT_SECRET` | Required | Yes | New high-entropy staging-only value; never reuse local/history. |
| `SMTP_ENABLED` | Required policy | No | `false` for initial staging. |
| `SMTP_HOST` | Conditional | No | Add only when SMTP is approved and enabled. |
| `SMTP_PORT` | Conditional | No | Provider value when enabled. |
| `SMTP_SECURE` | Conditional | No | Provider setting when enabled. |
| `SMTP_USER` | Conditional | Yes | New staging SMTP account when enabled. |
| `SMTP_PASS` | Conditional | Yes | New staging SMTP credential when enabled. |
| `SMTP_FROM` | Conditional | No | Verified staging sender when enabled. |
| `SMTP_DEBUG` | Optional | No | `false`; enable only temporarily without logging secrets. |
| `BACKUP_AUTO_ENABLED` | Required policy | No | `false` on Railway. |
| `BACKUP_DIR` | Not used initially | No | Omit; no persistent app volume. |
| `BACKUP_RETENTION_COUNT` | Not used initially | No | Omit. |
| `MYSQL_BIN_DIR` | Not used on web service | No | Omit. |
| `SUPERADMIN_PASSWORD` | Conditional | Yes | Fresh staging-only value only during an explicitly approved bootstrap. |
| `PROTECTED_BUSINESS_DATABASE` | Required for maintenance | No | Name of the protected production/authoritative database; must differ from staging target. |
| `ALLOW_DISPOSABLE_DB_MUTATION` | Maintenance only | No | Set to `YES` only for an explicitly approved staging maintenance command, then remove. |
| `ERP_CREATE_WEBSITE_SALE_VALIDATION_ENABLED` | Conditional | No | `false` until the private commerce integration is approved. |
| `ERP_CREATE_WEBSITE_SALE_VALIDATION_SECRET` | Conditional | Yes | New staging-only secret if the integration is enabled. |
| `ERP_CREATE_WEBSITE_SALE_VALIDATION_KEY_ID` | Conditional | No | Staging key identifier when enabled. |
| `ERP_CREATE_WEBSITE_SALE_VALIDATION_ISSUER` | Conditional | No | Approved staging issuer when enabled. |
| `ERP_CREATE_WEBSITE_SALE_VALIDATION_AUDIENCE` | Conditional | No | Approved staging audience when enabled. |
| `ERP_CREATE_WEBSITE_SALE_VALIDATION_TTL_SECONDS` | Optional | No | Keep reviewed default unless integration requires otherwise. |
| `ALLOW_TEST_PROCESS_LOT_DELETE` | Forbidden in staging | No | Omit/false. |

Test base URL variables are test-runner inputs, not Railway web-service configuration.

## Fresh credential requirements

Staging must use a new Railway MySQL credential set, a new staging JWT secret, and—only if later enabled—a new SMTP credential and website-sale validation secret. A staging SuperAdmin credential may be created only through an explicitly approved guarded bootstrap. No staging secret may reuse a value that exists in local configuration or Git history, and no secret may be stored in Git.

## Database preparation order (not executed by this manifest)

1. Provision an isolated, clearly named Railway staging MySQL database.
2. Record its non-secret identity and prove it is not the authoritative `jewellery_erp` database.
3. Create and verify a source backup without exposing credentials.
4. Import into staging, compare table/row counts and business fingerprints, and verify invoice sequence, stock, branches, companies, and module access.
5. Set the protected-database guard and run the explicit migration command only against staging.
6. Run schema compatibility and reconciliation checks, then remove the temporary mutation approval.
7. Start the web service with `SMTP_ENABLED=false`; verify `/health`, `/ready`, authentication isolation, and the ERP workflow checklist.

Rollback is replacement-based: stop the failed web release or roll back its deployment; for import or migration failures, discard/recreate the non-authoritative staging database from the verified source dump. Never repair the authoritative local database as part of staging rollback.

## Phase 3B safety checkpoint

Before Phase 3B edits, recoverable Git objects were saved for only the intended edit targets:

- `.gitignore`: `48fef0cb9873f1038a0b48ac80c1800704336dcc`
- `tests/phase8e-durable-lifecycle.test.js`: `6198103349f3ac15a2a9dbc4877b5b9e82dcb3ef`

These objects contain no `.env` content.
