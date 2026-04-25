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

## Backup command

From the project root:

```bash
npm run backup:mysql
```

What it does:
- creates the backup folder if needed
- exports the configured MySQL database using `mysqldump`
- writes a timestamped `.sql` file into `BACKUP_DIR`

Example output file:

```text
backups/erp-clean-live-2026-04-24T18-30-00.sql
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
