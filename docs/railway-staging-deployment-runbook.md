# Railway staging deployment runbook

**Status:** PREPARATION ONLY — NOT AUTHORIZED FOR EXECUTION

**Prepared:** 2026-10-04

**Authoritative system today:** local ERP with `localhost:3306 / jewellery_erp`

This runbook documents a future Railway **staging** deployment. It does not authorize a Railway project, Railway MySQL, deployment, database upload/import, migration, Git commit/push, credential rotation, SuperAdmin bootstrap, or production cutover. Stop unless the user explicitly approves the deployment phase.

Never place a real password, token, private key, dump, or `.env` value in this document, Git, command history, logs, or reports. Every value written as `<PLACEHOLDER>` must be supplied through an approved secret store at execution time.

## 1. Non-negotiable boundaries

- `jewellery_erp` remains the authoritative business database throughout staging.
- Staging is isolated and non-authoritative. It must never accept authoritative business writes.
- The real database is a read-only source for a controlled local copy only.
- Never run migration, sanitization, test transactions, or SuperAdmin bootstrap against `jewellery_erp`.
- Ordinary `npm start` must never run migrations, data backfills, or SuperAdmin synchronization.
- Initial staging uses `SMTP_ENABLED=false`.
- Production cutover is a later, separately approved phase.
- Any failed checkpoint is a STOP. Use its rollback before continuing.

## 2. Current release checkpoint and known delta

Phase 3B established the Railway configuration, exclusion rules, safe test suite, and release manifest. Changes made afterward must be reviewed before a release commit. At the time this runbook was prepared, the paid-sales-return and Colour Plant receipt work introduced these release-relevant deltas:

- `js/backend/returnPolicy.js` is required by `js/backend/server.js`.
- `js/colour-plant-receipt-print.js` is required by `colour-plant.html`.
- `tests/return.test.js` and `tests/colourPlantReceiptPrint.test.js` verify those changes.
- `js/backend/server.js`, `return.html`, and `colour-plant.html` contain corresponding changes.

These files were individually reviewed and added to the proposed release staging set during Phase 4A; no commit or push was performed. The full repository also contains unrelated storefront/API/documentation work; do not include it blindly in the ERP staging commit.

## 3. Intended staging architecture

```text
Railway staging environment
|
+-- ERP Web Service
|   +-- Railpack
|   +-- npm start
|   +-- one replica
|   +-- Railway HTTPS staging domain
|   +-- /ready deployment health check
|   +-- /health liveness endpoint
|
+-- Railway MySQL
    +-- private networking to the web service
    +-- isolated, clearly named staging database
    +-- non-authoritative sanitized data only
```

Confirmed by the repository:

- `railway.json` selects `RAILPACK`, `npm start`, and `/ready`.
- `package.json` starts `js/backend/server.js`.
- The application listens on Railway's `PORT`.
- Production validation requires an HTTPS `APP_ORIGIN`, database settings, and a strong `JWT_SECRET`.
- `/ready` remains closed until configuration, database connectivity, and schema compatibility pass.
- No persistent application volume is required. Automatic application backups remain disabled; Railway database backup/restore must be validated separately.

## 4. Railway environment-variable checklist

Do not fill secret placeholders in Git. Railway-supplied values should use Railway service references or its secret-variable UI when deployment is authorized.

| Variable | Class | Secret | Supplier | Staging strategy |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | REQUIRED | No | Operator | Set `production`. |
| `PORT` | REQUIRED/Railway-supplied | No | Railway | Do not hard-code; Railway injects it. |
| `RAILWAY_ENVIRONMENT` | Railway-supplied | No | Railway | Leave platform-managed. |
| `APP_ORIGIN` | REQUIRED | No | Railway/operator | Exact generated staging HTTPS origin, with no path/query/fragment. |
| `MYSQLHOST` | REQUIRED | No | Railway MySQL | Private host/service reference. |
| `MYSQLPORT` | REQUIRED | No | Railway MySQL | Private port/service reference. |
| `MYSQLUSER` | REQUIRED | Yes | Railway MySQL | Fresh staging database user/reference. |
| `MYSQLPASSWORD` | REQUIRED | Yes | Railway MySQL | Fresh staging password/reference. |
| `MYSQLDATABASE` | REQUIRED | No | Operator/Railway MySQL | Clearly named staging schema; never `jewellery_erp`. |
| `JWT_SECRET` | REQUIRED | Yes | Operator secret manager | New high-entropy staging-only value, at least 32 characters. |
| `SMTP_ENABLED` | REQUIRED POLICY | No | Operator | Set `false` for initial staging. |
| `SMTP_HOST` | CONDITIONAL | No | SMTP provider | Omit until SMTP is explicitly enabled and tested. |
| `SMTP_PORT` | CONDITIONAL | No | SMTP provider | Provider port when enabled. |
| `SMTP_SECURE` | CONDITIONAL | No | SMTP provider | Provider TLS setting when enabled. |
| `SMTP_USER` | CONDITIONAL | Yes | SMTP provider | Fresh staging account when enabled. |
| `SMTP_PASS` | CONDITIONAL | Yes | SMTP provider | Fresh staging credential when enabled. |
| `SMTP_FROM` | CONDITIONAL | No | SMTP provider | Verified staging sender when enabled. |
| `SMTP_DEBUG` | OPTIONAL | No | Operator | `false`; temporary diagnostic use must not expose secrets. |
| `BACKUP_AUTO_ENABLED` | REQUIRED POLICY | No | Operator | Set `false` on Railway. |
| `BACKUP_DIR` | MAINTENANCE ONLY | No | Operator | Omit from web service; no persistent app volume. |
| `BACKUP_RETENTION_COUNT` | MAINTENANCE ONLY | No | Operator | Omit unless a separate approved backup job uses it. |
| `MYSQL_BIN_DIR` | MAINTENANCE ONLY | No | Admin runtime | Omit from the web service; only for explicit MySQL tools. |
| `SUPERADMIN_PASSWORD` | MAINTENANCE ONLY | Yes | Operator secret manager | Set temporarily only for an explicitly approved staging bootstrap, then remove. |
| `PROTECTED_BUSINESS_DATABASE` | MAINTENANCE ONLY | No | Operator | Set to the protected authoritative name `jewellery_erp`. |
| `ALLOW_DISPOSABLE_DB_MUTATION` | MAINTENANCE ONLY | No | Operator | Default `NO`; set `YES` only for an approved staging migration/bootstrap command, then remove/reset. |
| `CONFIRM_RESTORE` | MAINTENANCE ONLY | No | Operator | Temporary `YES` only for an explicitly approved restore into proven staging. |
| `BACKUP_FILE` | MAINTENANCE ONLY | No | Operator | Verified sanitized dump path in the maintenance runtime only. |
| `ERP_CREATE_WEBSITE_SALE_VALIDATION_ENABLED` | CONDITIONAL | No | Operator | `false` until the private integration is approved. |
| `ERP_CREATE_WEBSITE_SALE_VALIDATION_SECRET` | CONDITIONAL | Yes | Operator secret manager | New staging-only secret if enabled. |
| `ERP_CREATE_WEBSITE_SALE_VALIDATION_KEY_ID` | CONDITIONAL | No | Integration owner | Staging key identifier when enabled. |
| `ERP_CREATE_WEBSITE_SALE_VALIDATION_ISSUER` | CONDITIONAL | No | Integration owner | Approved staging issuer when enabled. |
| `ERP_CREATE_WEBSITE_SALE_VALIDATION_AUDIENCE` | CONDITIONAL | No | Integration owner | Approved staging audience when enabled. |
| `ERP_CREATE_WEBSITE_SALE_VALIDATION_TTL_SECONDS` | OPTIONAL | No | Integration owner | Keep the reviewed default unless the integration requires a change. |
| `ALLOW_TEST_PROCESS_LOT_DELETE` | FORBIDDEN IN STAGING | No | Nobody | Omit or set `false`. |

## 5. Fresh credential strategy

When staging is authorized, create new values for:

- Railway MySQL host/user/password/database references.
- Staging-only `JWT_SECRET`.
- Website-sale validation secret only if that integration is enabled.
- Staging SuperAdmin password only if a separate bootstrap approval exists.
- SMTP credentials only after SMTP is approved, upgraded, and tested.

Never reuse a current local value or any value that appeared in Git history. Store secrets only in Railway/approved secret management. Do not generate permanent credentials until the staging resources exist and the user has approved deployment.

## 6. Local copy and sanitization plan

The only permitted data path is:

```text
REAL LOCAL DB: jewellery_erp (read-only source)
        |
        v
LOCAL DISPOSABLE CLONE: <LOCAL_DISPOSABLE_NAME>
        |
        v
SANITIZED LOCAL STAGING COPY: <SANITIZED_STAGING_NAME>
        |
        v
FUTURE AUTHORIZED IMPORT -> Railway staging MySQL
```

### Copy gate

1. Record the non-secret source identity: host, port, database, and MySQL version.
2. Prove source database is exactly `jewellery_erp` and clone target is not.
3. Capture source schema and business-data fingerprints read-only.
4. Create a consistent source dump using `mysqldump --single-transaction --routines --triggers --events --hex-blob` with credentials supplied outside the command line.
5. Verify command success, file existence, non-zero size, dump header, and a restore rehearsal into the disposable clone.
6. Never run any sanitizer against the source connection.

### Sanitization requirements

Run a reviewed, transaction-safe sanitizer only on the disposable clone. Preserve business relationships while replacing sensitive values:

- Customer, party, vendor, karigar, employee, and company contact names where staging does not require the real name.
- Phone/mobile numbers, email addresses, postal addresses, GST/PAN/tax identifiers, bank/payment references, and free-text notes that may contain personal data.
- Usernames where identifying; replace authentication password hashes with staging-only hashes or disable accounts.
- OTP verification rows, password-reset material, sessions, tokens, integration credentials, API secrets, and any secret-bearing configuration rows.
- Audit IP addresses, user-agent data, request bodies, and serialized payloads containing personal/contact data.
- SMTP addresses and notification recipients.

Preserve internally consistent surrogate IDs, company/branch ownership, invoice relationships, stock/barcode relationships, quantities, weights, statuses, transfers, returns, process/karigar relationships, expenses, Colour Plant relationships, and module-access relationships. Do not log before/after personal values.

### Sanitization acceptance

- Scan the sanitized database for known source email/phone patterns and forbidden secret categories.
- Confirm every enabled staging login is explicitly authorized and uses a staging credential.
- Compare non-sensitive counts/invariants with the disposable pre-sanitization baseline.
- Export a new sanitized dump. Never upload the unsanitized source dump.

## 7. Future staging import procedure

None of these steps may be executed in Phase 4A.

1. Create the Railway staging MySQL service only after explicit approval.
2. Create/select an isolated staging schema and prove its name is not `jewellery_erp`.
3. Record a pre-import snapshot/backup of the empty staging service.
4. Import only the verified sanitized dump through an approved maintenance connection.
5. Compare table count and per-table row counts.
6. Compare schema fingerprint with the sanitized local source.
7. Compare non-sensitive business fingerprints and invariants.
8. Verify invoice sequence/current maximum, stock states/counts/barcode uniqueness, branch/company ownership, transfer states, returns, process/karigar data, party metal balances, expenses/cash ledger, Colour Plant data, and company/module access.
9. Run the read-only schema compatibility checker.
10. If incompatible, stop and review the exact delta. Only then set the staging maintenance guard and run the explicit migration command against the proven staging database. Never run a broad or automatic migration merely to force readiness.
11. Re-run compatibility and all reconciliation checks; reset/remove maintenance mutation approval.
12. Configure the web service and run ordinary `npm start`.
13. Prove startup performed zero migration, zero backfill, and zero SuperAdmin synchronization.
14. Verify `/health`, then `/ready`, then `/login.html`.
15. Capture a new fingerprint and confirm ordinary startup caused no business-data mutation.
16. Begin the approved staging workflow test plan.

## 8. Future Git release plan

### Branch strategy

1. Preserve the current dirty working tree and unrelated user work.
2. From a reviewed base, create `codex/railway-staging` only after approval.
3. Stage files individually; never use `git add .`.
4. Keep unrelated storefront/API/documentation experiments out of the ERP staging commit unless separately reviewed and intentionally included.

### Intended ERP release content

- `package.json`, `package-lock.json`, `railway.json`, `.env.example`, and `.gitignore`.
- Root ERP HTML/CSS/browser JavaScript/assets served by `server.js`.
- All recursively imported backend modules, including `startupSafety.js`, `colourPlant.js`, website-sale validation modules, stock-cost authority, and `returnPolicy.js`.
- `colour-plant.html` with `js/colour-plant-receipt-print.js`.
- Reviewed migration history and guarded maintenance scripts required for staging administration.
- Safe deployment/startup/ERP regression tests, including the return and Colour Plant receipt tests.
- `docs/railway-staging-release-manifest.md` and this runbook.

### Explicit exclusions

- `.env`, `.env.*` except `.env.example`.
- Credentials, keys, tokens, cookies, database passwords, private keys, and customer data dumps.
- `backups/`, `reports/`, `database-dumps/`, `dumps/`, `*.dump`, `*.sql.gz`, and `*.sql.bz2`.
- `cookies.txt`, `*.log`, `current-start-error.txt`, `start-error.txt`, temporary release simulations, and disposable database artifacts.

### Pre-commit verification

```powershell
git status --short
git diff --check
git diff --cached --check
git diff --cached --name-status
git check-ignore -v .env backups reports cookies.txt server-debug.log current-start-error.txt start-error.txt sample.dump sample.sql.gz
git ls-files --error-unmatch js/backend/returnPolicy.js js/colour-plant-receipt-print.js
npm ci
npm test
node --check js/backend/server.js
```

Also run a secret scan and a clean-checkout simulation containing no `.env`. The simulation must prove that `npm start` can resolve every local runtime module before any commit.

### Future commit and push (not authorized now)

Proposed commit purpose/message:

```text
chore(release): prepare ERP for Railway staging
```

After explicit approval only:

```powershell
git commit -m "chore(release): prepare ERP for Railway staging"
git show --stat --oneline HEAD
git diff HEAD^ HEAD --check
npm test
git push -u origin codex/railway-staging
```

Push only after confirming the commit contains every required runtime file and none of the exclusions or secrets.

## 9. Deployment checkpoints and rollback

### CHECKPOINT A — Release verification

GO only if the intended file list, secret scan, safe tests, syntax checks, and clean-checkout simulation pass.

Rollback: do not modify user work. Unstage only the individually reviewed Phase 4 release paths if the user explicitly requests it; otherwise leave the working tree unchanged and correct the release plan.

### CHECKPOINT B — Approved Git commit/push

GO only with explicit user authorization and a reviewed commit diff.

Rollback: do not rewrite shared history. If already pushed, use a reviewed forward revert/new corrective commit; do not force-push.

### CHECKPOINT C — Railway project/environment creation

GO only after the user explicitly authorizes Railway resource creation.

Rollback: if empty and unused, delete only the newly created staging resources after verifying their exact identities; otherwise disable access and request approval.

### CHECKPOINT D — Railway MySQL provisioning

GO only if the service is clearly staging, isolated, and non-authoritative.

Rollback: remove/recreate only the staging database service. Never alter the local authoritative database.

### CHECKPOINT E — Sanitized import and reconciliation

GO only if the dump is sanitized and fingerprints/counts reconcile.

Rollback: discard/recreate the staging schema from the verified sanitized dump. Do not manually patch the authoritative database.

### CHECKPOINT F — Variables and credentials

GO only if required variables are present, secrets are new, `SMTP_ENABLED=false`, the DB target is staging, and no secret appears in logs/Git.

Rollback: restore the last reviewed Railway variable set, revoke newly exposed staging-only secrets if necessary, and redeploy nothing until validation passes.

### CHECKPOINT G — ERP web deployment

GO only if build succeeds and `/ready` reaches HTTP 200. One replica only.

Rollback: roll back to the last passing Railway deployment or stop the staging web service. The local ERP remains unaffected and authoritative.

### CHECKPOINT H — Read-only staging verification

GO only if `/health`, `/ready`, login page, authentication boundaries, schema compatibility, and no-startup-mutation checks pass.

Rollback: stop staging traffic and return to the preceding web/database snapshot.

### CHECKPOINT I — Controlled staging workflow tests

GO only after a baseline backup/fingerprint and explicit approval for staging test writes.

Rollback: restore/recreate the disposable staging database from the sanitized pre-test snapshot.

## 10. Staging acceptance checklist

### Authentication and isolation

- Valid staging login and logout.
- Invalid login rejection and rate limiting.
- Unauthorized API/page rejection.
- Company isolation and branch isolation.
- Cookie/JWT behavior over HTTPS; no source local credentials reused.

### Stickers and stock

- Sticker creation, barcode generation/lookup, uniqueness enforcement, and print preview.
- Stock totals, states, barcode uniqueness, company ownership, and branch ownership.

### Billing and returns

- GST and NON_GST bills.
- Cash, online, due, partial payment, and Add Payment paths.
- Invoice sequence continuity and exact stock deduction.
- Unpaid, partial-paid, fully-paid, and Add-Payment-then-return flows.
- Stock restored once; duplicate return/refund blocked; ledger/reversal reconciles.

### Other ERP workflows

- Returns and cancellation safeguards.
- Branch transfer, dispatch, receive, shortage, ownership, and no double application.
- Process/Karigar lots, steps, weights, quantities, PIN component behavior, completion, and correction safeguards.
- Party Metal Account balances and settlement history.
- Expense Manager, idempotency, cash ledger, and payment accounts.
- Colour Plant receive, rate calculation, job flow, payments, compact receipt, and barcode-label printing.
- Company plans, module access, analytics, lifecycle audit, and reconciliation dashboards.

### Operations

- `/health` is HTTP 200 while alive.
- `/ready` is 503 before initialization and 200 only after all gates pass.
- Restart/redeploy preserves readiness and data.
- SIGTERM/SIGINT sets readiness false, closes HTTP and DB pool, and exits cleanly.
- Ordinary startup/shutdown causes zero schema mutation, zero business-data mutation, and zero SuperAdmin synchronization.

Record test fixture IDs and remove/recreate only staging data after testing. Never run these write tests against the local real database.

## 11. Production boundary

Railway staging is not production. The local ERP remains authoritative and continues accepting real writes until a separately approved production cutover maintenance window.

A future production cutover must require, in order:

1. All production security blockers resolved and independently verified.
2. Staging acceptance PASS.
3. Production credentials rotated/new and stored securely.
4. Railway backup and restore rehearsal PASS.
5. Final verified local backup.
6. Announced maintenance window.
7. **Local write freeze begins before the final production dump.** No new local business write may occur after this point.
8. Final database transfer and explicit migration/compatibility verification.
9. Full reconciliation and read-only Railway verification.
10. Explicit approval to enable Railway production writes.
11. Full production workflow verification.
12. Local database retained read-only as rollback evidence until the approved retention period ends.

If local writes resume before cloud write enable, abort the cutover and repeat from a new final backup. Never allow local and Railway production to accept authoritative writes simultaneously.

## 12. Security work required before production

These items are not resolved by this runbook:

- Dependency audit findings, including current Express/body-parser/qs, MySQL2, and Nodemailer advisories.
- Nodemailer major upgrade and SMTP security/functional testing before enabling mail.
- Complete Helmet/security-header and Content Security Policy review.
- Server-side CSRF protection for cookie-authenticated state-changing requests.
- Removal or containment of JWT exposure through browser localStorage/legacy token paths.
- Logout/session/token revocation design and verification.
- Rotation of every historically exposed database, JWT, SMTP, SuperAdmin, and integration credential.
- Railway database backup scheduling, restore rehearsal, retention, encryption, and access-control verification.

Initial staging may run with SMTP disabled, but the remaining production blockers must not be marked resolved merely because staging works.

## 13. Authorization request for the future deployment phase

When ready, the user should explicitly authorize a new staging-deployment phase and identify:

- Approval to create a Railway staging project/environment, MySQL service, and public staging domain.
- Approval to create and push the reviewed Git branch/commit.
- Approved sanitized dataset and staging database name.
- Approved fresh-secret owner and storage location.
- Whether staging SuperAdmin bootstrap is approved.
- Confirmation that SMTP remains disabled.

Until that authorization is received: **STOP. Do not execute any checkpoint.**
