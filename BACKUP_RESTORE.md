# MySQL Backup and Restore Baseline

This ERP now includes a safe baseline for MySQL backup operations.

Important:
- Do not run restore directly on production without a tested backup and a maintenance window.
- Do not store database passwords inside npm scripts or committed files.
- Always verify a restore on a non-production database first.

## Environment prerequisites

Use the existing database environment variables:

- `MYSQLHOST`
- `MYSQLPORT`
- `MYSQLUSER`
- `MYSQLPASSWORD`
- `MYSQLDATABASE`

Optional helper variables:

- `BACKUP_DIR`  
  Default backup output folder used by the helper script. Example: `./backups`
- `MYSQL_BIN_DIR`  
  Optional folder containing `mysqldump` and `mysql` if they are not available in `PATH`
- `BACKUP_RETENTION_COUNT`  
  Number of local `.sql` backups to keep. Default: `7`.
- `BACKUP_AUTO_ENABLED`  
  Set to `false` only if the backend server should not run the daily automatic backup check.

## Backup command

From the project root:

```bash
npm run backup:mysql
```

What it does:
- creates the backup folder if needed
- exports the configured MySQL database using `mysqldump`
- writes a timestamped `.sql` file into `BACKUP_DIR`
- keeps only the newest `BACKUP_RETENTION_COUNT` backup files

Example output file:

```text
backups/erp-clean-live-2026-04-24T18-30-00.sql
```

## Automatic daily backup

When the backend starts successfully, it schedules a backup check every 24 hours. The first check runs about one minute after startup.

The automatic check:

- creates a new MySQL backup only when the latest local backup is missing or older than 24 hours
- uses the same `BACKUP_DIR`, `MYSQL_BIN_DIR`, and MySQL environment variables as the manual backup command
- prunes old local backups after a successful backup
- logs failures without attempting any restore

## Backup health API

Owners and Accounts users can read:

```text
GET /backup/health
```

The response includes:

- backup folder
- backup count
- latest backup file
- latest backup age in hours
- warning when no backup exists or the newest backup is older than 24 hours
- total local backup size
- retention count
- automatic backup enabled state

Owners can create and download backups:

```text
POST /backup/create
GET /backup/download?file=backup-file.sql
```

## Restore command

Restore is intentionally protected by an explicit confirmation variable.

Required variables before restore:

- `BACKUP_FILE` = full or relative path to the `.sql` file
- `CONFIRM_RESTORE=YES`

Command:

```bash
BACKUP_FILE=./backups/your-backup.sql CONFIRM_RESTORE=YES npm run restore:mysql
```

On Windows PowerShell:

```powershell
$env:BACKUP_FILE="./backups/your-backup.sql"
$env:CONFIRM_RESTORE="YES"
npm run restore:mysql
```

## Manual commands (without npm helper)

If you prefer manual commands:

### Backup

```bash
mysqldump -h %MYSQLHOST% -P %MYSQLPORT% -u %MYSQLUSER% %MYSQLDATABASE% > backup.sql
```

PowerShell example:

```powershell
mysqldump -h $env:MYSQLHOST -P $env:MYSQLPORT -u $env:MYSQLUSER $env:MYSQLDATABASE > backup.sql
```

### Restore

```bash
mysql -h %MYSQLHOST% -P %MYSQLPORT% -u %MYSQLUSER% %MYSQLDATABASE% < backup.sql
```

PowerShell example:

```powershell
Get-Content .\backup.sql | mysql -h $env:MYSQLHOST -P $env:MYSQLPORT -u $env:MYSQLUSER $env:MYSQLDATABASE
```

Note:
- `MYSQLPASSWORD` should be provided through environment variables, not typed into saved scripts.

## Offsite backup process

Local backups protect against database mistakes, but they do not protect against machine loss. Keep at least one off-machine copy of recent backup files.

Recommended safe process:

1. Use `GET /backup/download` or copy files from `BACKUP_DIR`.
2. Store copies in a restricted cloud drive, external disk, or another server.
3. Protect offsite copies with access control appropriate for customer and financial data.
4. Test at least one offsite backup on a non-production database before relying on it.

Do not commit `.sql` backup files to git.

## ERP source file backup

The ERP source should be recoverable from git plus deployment configuration.

Minimum source recovery checklist:

1. Confirm the latest source is pushed to the remote repository.
2. Keep deployment files such as `package.json`, `package-lock.json`, `railway.json`, frontend files, backend files, and scripts in version control.
3. Do not store `node_modules`, local logs, `.env`, or database backups in git.
4. Record the Node.js and MySQL versions used in production.

## `.env` recovery process

The `.env` file contains secrets and should not be committed. Keep a secure password-manager entry or encrypted operations note with these required values:

```text
MYSQLHOST
MYSQLPORT
MYSQLUSER
MYSQLPASSWORD
MYSQLDATABASE
JWT_SECRET
SUPERADMIN_PASSWORD
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
MYSQL_BIN_DIR
BACKUP_DIR
BACKUP_RETENTION_COUNT
BACKUP_AUTO_ENABLED
```

After restoring `.env`, restart the backend and check `/backup/health`.

## Tables to verify after restore

After any restore, verify these business-critical tables first:

- `sales_history`
- `sales_items`
- `transaction_master`
- `transaction_lines`
- `transaction_settlements`
- `invoice_transaction_link`
- `cash_ledger`
- `metal_ledger`
- `stock`
- `company_settings`
- `invoice_drafts`
- `invoice_draft_items`

## Post-restore verification checklist

1. Confirm the application starts successfully.
2. Log in with a valid user.
3. Open Billing, Sales History, Settings, and Dashboard.
4. Confirm the latest invoices exist in `sales_history`.
5. Confirm invoice items exist in `sales_items`.
6. Confirm accounting linkage exists in:
   - `transaction_master`
   - `transaction_settlements`
   - `invoice_transaction_link`
7. Confirm stock records still match expected sold/available states.
8. Confirm company settings load correctly in the UI.
9. Print one GST invoice and compare totals with saved records.
10. Keep the pre-restore backup until business verification is complete.

## Production warning

- Never restore directly over live production data without taking a fresh backup first.
- Never test an unknown backup file on production first.
- Keep at least one off-machine backup copy.
