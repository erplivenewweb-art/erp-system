# Phase 1A — ERP Protection and Architecture Foundation

Baseline captured on 2026-07-11 (Asia/Calcutta). This directory is documentation-only. It does not authorize or implement commerce, schema, route, authentication, deployment, or ERP behavior changes.

## Repository baseline

- Branch: `main` (tracking `origin/main`)
- Commit: `b2ae2e1f1fd2eff2411ca3869c3048f4ba1899d8`
- Working tree at capture: dirty before Phase 1A
- Pre-existing modified files: `billing.html`, `customer-ledger.html`, `invoice.html`, `js/backend/server.js`, `js/libs/jspdf.min.js`, `js/libs/jspdf.plugin.autotable.min.js`, `party-metal-account.html`, `process.html`, `sales-history.html`, `sticker.html`, `stock.html`, `transaction-reports.html`, `transaction.html`
- Pre-existing untracked file: `js/libs/html2canvas.min.js`
- New commerce work: none
- Phase 1A work: new files only under `docs/phase-1a/`

The pre-existing dirty files are ERP work owned by the user. They must not be overwritten, staged, reverted, reformatted, renamed, moved, or included in a future commerce commit.

## Protected ERP boundary

All content that existed at the baseline commit or in the pre-existing dirty tree is protected. In particular:

- Backend: `js/backend/server.js`, `js/backend/authMiddleware.js`, database connection/startup/schema code, middleware, route handlers, backup/restore scripts.
- Frontend: every existing root `*.html`, `css/`, `icons/`, existing frontend files under `js/`, `manifest.json`, and `service-worker.js`.
- Operations: `package.json`, `package-lock.json`, `railway.json`, `.env`, `.env.example`, `README.md`, `BACKUP_RESTORE.md`, and `scripts/`.
- Routes: every route in `ERP_ROUTE_BASELINE.md`, including its method, path, ordering, middleware, semantics, response contract, and ownership.
- Database: the ERP exclusively owns all current tables, columns, indexes, constraints, identifiers, lifecycle rules, and startup schema behavior.
- Security: JWT secret/token format, `erp_auth_token`, bearer-token support, 12-hour expiry, login/logout/OTP/reset flows, access/session validators, roles, page guards, company scoping, branch scoping, and module enforcement.

Commerce code must be additive and isolated. It may consume an explicitly approved integration contract later; it may never query or mutate ERP tables directly, reuse ERP credentials, bypass ERP middleware, or become the source of truth for ERP-owned data.

## Current architecture

### Entry points and deployment

- Backend entry: `js/backend/server.js` (CommonJS Express application).
- Frontend entry: root `index.html`; authenticated ERP pages are root HTML files. Express serves `/css`, `/icons`, `/js`, `manifest.json`, `service-worker.js`, `/`, and a constrained `/:page` HTML route.
- Port: `process.env.PORT`, default `8080`; binds `0.0.0.0`. MySQL defaults to port `3306` when `MYSQLPORT` is absent.
- Railway: `railway.json` selects `NIXPACKS`, starts with `npm start`, checks `/health`, retries on failure up to 10 times.
- Nixpacks: no repository `nixpacks.toml`; Railway auto-detection is therefore part of the protected deployment contract.
- Root scripts: `start` and `dev` both run `node js/backend/server.js`; backup and restore scripts invoke the existing MySQL utilities.
- Build: no compile/bundle script. Deployment installs Node dependencies and starts the server.
- Health: public `GET /health`; public `GET /ready` additionally represents readiness. No health behavior was invoked or modified in Phase 1A.
- Service worker: `service-worker.js` caches the ERP shell and same-origin static/navigation GETs under `erp-panel-pwa-v6`; it is protected.

### Startup and schema flow

1. Load root `.env`; construct Express and global middleware.
2. Register static/page routes, health/readiness, then ERP APIs and final error handlers.
3. `bootstrapServer()` logs safe configuration and starts listening immediately.
4. Background startup validates DB, SuperAdmin, and JWT configuration; tests MySQL; calls `ensureSchema()`; ensures the SuperAdmin; schedules backups; then tests SMTP.
5. `ensureSchema()` contains existing `CREATE TABLE IF NOT EXISTS`, column/index checks, conditional `ALTER TABLE` operations, defaults, and startup data synchronization. This is production-owned schema evolution, not a commerce migration system.

No migration, SQL, schema, package script, static serving, service worker, Railway, or startup change was made.

### Authentication and authorization

- Login issues a JWT through the existing flow. Tokens are accepted from `Authorization: Bearer` or the `erp_auth_token` cookie.
- `authMiddleware` verifies JWT, validates the active session/access state, refreshes request identity from the database, and rejects unauthorized requests.
- `requirePageAuth` redirects unauthenticated protected-page requests to `login.html`.
- `checkRole` applies role allowlists; `SUPERADMIN` bypasses those allowlists, while a separate global guard blocks SuperAdmin operational mutations.
- Canonical roles include `SUPERADMIN`, `OWNER`, `ACCOUNTS`, and `STAFF`; legacy/module role values normalize into these roles.
- Module preview/enforcement middleware and company-plan/module access are protected authorization behavior.

### Tenant and branch isolation

- Company identity is carried in authenticated claims and revalidated against the user record. Operational queries use company-scoped access helpers and `company_id` predicates. SuperAdmin handling is explicit.
- Branch identity and permissions are resolved by existing branch-access helpers. Branch-scoped reads/writes, transfer workflows, audit/reconciliation, and report permissions remain ERP-owned.
- Future commerce must not trust client-supplied company/branch identifiers or reproduce isolation logic. Integration must call an approved ERP boundary that derives scope from authenticated server-side context.

### Domain ownership and API inventory

ERP is the sole system of record for products/stickers/barcodes, inventory and stock, billing/invoices/GST, manufacturing/process/materials, sales/returns/refunds, branches/transfers, company isolation, authentication/authorization, finance/ledgers, backups, reconciliation, and ERP analytics. A website may display approved projections and submit approved commands later, but never owns these domains.

The current API inventory contains 252 declared `app.get/post/put/patch/delete` routes in `js/backend/server.js`. The immutable method/path inventory, access classification, and owner are in `ERP_ROUTE_BASELINE.md`. Critical families include `/login`, `/auth/*`, `/otp/*`, `/getStock`, sticker/barcode routes, `/saveBilling`, invoice/sales/return routes, `/process/*`, `/materialStock/*`, `/branches*`, `/branch-*`, `/transaction/*`, `/settings/*`, `/superadmin/*`, `/backup/*`, `/health`, and `/ready`.

## Database baseline and ownership

Current startup-managed tables are grouped below. All are protected ERP tables; category labels do not transfer ownership.

- Company/tenant: `companies`, `company_signup_requests`, `company_settings`.
- Authentication/authorization: `users`, `otp_verifications`, `erp_modules`, `erp_plans`, `erp_plan_modules`, `company_plan_assignments`, `company_module_access`, `company_module_access_audit`, `module_access_violation_logs`, `module_enforcement_settings`, `module_access_enforcement_events`, `audit_log`.
- Inventory/barcode: `stock`, `barcode_lifecycle_events`, `material_stock_items`, `material_stock_movements`.
- Billing/sales/returns: `sales_history`, `sales_items`, `sales_cancellations`, `invoice_sequences`, `invoice_drafts`, `invoice_draft_items`, `return_history`, `return_refund_payables`.
- Branch: `branches`, `branch_transfers`, `branch_transfer_items`, `branch_receive_logs`, `branch_transfer_audit_logs`, `branch_stock_snapshots`, `branch_stock_snapshot_items`, `branch_reconciliation_runs`, `branch_reconciliation_exceptions`, `branch_audit_alerts`.
- Manufacturing/process: `process_templates`, `process_template_steps`, `process_lots`, `process_steps`, `process_step_additive_issues`, `process_job_slips`, `process_additive_stock_movements`, `process_step_correction_batches`, `process_step_reversal_entries`, `process_material_issues`, `process_step_recovery_inputs`, `process_lamination_weights`, `outside_karigar_ledger`, `karigar_work`.
- Finance/ledger: `party_master`, `party_opening_balance`, `metal_master`, `transaction_master`, `transaction_types`, `transaction_lines`, `transaction_settlements`, `cash_ledger`, `payment_accounts`, `daily_cash_closing`, `daily_cash_closing_audit`, `metal_ledger`, `party_balance_summary`, `expenses`.
- Link/reconciliation/analytics support: `invoice_transaction_link`, `purchase_transaction_link`, `lot_transaction_link`, `karigar_transaction_link` plus reporting derived from the protected operational tables. There is no separate commerce analytics ownership.

Database prohibition: no commerce migration may alter these tables or startup schema flow. No direct commerce SQL, foreign key, trigger, view, shared write connection, or identifier allocation is allowed without a separately approved architecture phase.

## Regression protection strategy (future work only)

- Route fingerprint: canonicalize ordered `METHOD path` pairs and compare SHA-256 against the Phase 1A baseline; separately review middleware/contract changes because a path hash cannot detect handler changes.
- Schema fingerprint: canonicalize current table names plus `SHOW CREATE TABLE` output from a disposable/restored test database; compare constraints/indexes/columns. Never run fingerprint tests against production.
- Protected API inventory: diff every method/path, access class, role restriction, owner, request/response contract, and error code.
- Smoke tests: boot against an isolated database; verify `/health`, `/ready`, static login, protected-page redirect, and representative read-only APIs.
- Authentication tests: cookie and bearer success/failure, expiry, logout/session invalidation, disabled users/companies, OTP/reset, role normalization, and rate limiting.
- Billing tests: invoice numbering/idempotency, totals/rounding/GST, drafts, cancellation/restore, ledgers, and company/branch scoping.
- Stock tests: barcode uniqueness/lifecycle, add/update/delete/restore, billing depletion, return restoration, transfers, material movements, and concurrent writes.
- Return tests: eligible/ineligible items, refund payable creation, duplicate return prevention, stock restoration, audit trail, and tenant/branch boundaries.
- Branch tests: permissions, transfer lifecycle, scan/dispatch/receive/shortage, snapshots, reconciliation, and cross-branch denial.
- Company isolation tests: attempt cross-company reads and mutations for every critical family and verify denial/no data leakage.
- Backup tests: create, integrity-check, restore only into an isolated disposable database, then verify counts/fingerprints and recovery documentation.
- Reconciliation tests: stock-sales, returns, branch transfer, process, and refund payable reports against controlled fixtures.

Production database tests are forbidden. Future automation must use disposable local/CI databases populated with synthetic or sanitized fixtures and must require explicit environment guards.

## Safe future insertion points

No requested future folder currently exists at repository root. The following root locations are structurally available but are only conditionally safe and were not created:

| Location | Finding | Conditions before use |
|---|---|---|
| `storefront/` | Safe candidate | Independent frontend build/output; must not overwrite root ERP static files or service-worker scope. |
| `commerce-api/` | Safe candidate | Separate service/runtime/database credentials; no direct ERP-table access. |
| `erp-integration-api/` | Safe candidate | ERP-owned adapter with explicit versioned contracts; requires later approval because it touches the ERP boundary. |
| `packages/` | Safe candidate | New commerce-only shared packages; no relocation/refactor of ERP code. |
| `docs/` | Safe and used for Phase 1A | Documentation only; existing root docs remain untouched. |
| `tests/` | Safe candidate | Isolated tests only; no production database or mutation of pre-existing ERP fixtures/files. |

These findings confirm namespace availability, not permission to begin Phase 1B or create the folders.

## Deployment impact

Phase 1A adds Markdown under `docs/phase-1a/` only. Neither `npm start` nor Railway references this path; Express does not expose a `/docs` static mount; the service worker does not cache it; no dependency/build step consumes it. Therefore Phase 1A has no expected production runtime, build, route, database, cache, or deployment effect.

## Safety and rollback

- Known risk: `js/backend/server.js` is both the central ERP implementation and pre-existing modified work, so any later edit has a high collision/regression risk.
- Known risk: startup performs schema reconciliation automatically; an unintended startup against the wrong database can mutate schema.
- Known risk: a route method/path fingerprint alone does not detect handler, SQL, middleware-order, or response-contract changes.
- Remaining risk: runtime behavior, database contents, environment correctness, Railway deployment, SMTP, backups, and business calculations were not exercised in this documentation-only phase.
- Rollback: delete only `docs/phase-1a/`. Do not reset, restore, or alter any pre-existing dirty file.
- Manual tests required before later deployment: execute the regression suites above in an isolated environment, validate Railway health/readiness, verify static/service-worker behavior, and perform a backup/restore rehearsal outside production.

## Phase status

Phase 1A documentation and protection baseline: complete. ERP regression status: no ERP code changed; static repository verification passes, while runtime/business regression execution is intentionally not run in this phase. Phase 1B and all commerce implementation remain blocked pending explicit approval.
