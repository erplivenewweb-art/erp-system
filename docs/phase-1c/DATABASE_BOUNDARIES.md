# Database Boundaries

Recommended logical topology:

```text
erp_db       — owned and migrated by ERP
commerce_db  — owned and migrated by Commerce
```

They may initially share a MySQL server, but use separate schemas, credentials, grants, migration histories, backups and restores.

- ERP projection credential: read-only, restricted to an ERP-owned adapter and approved views/service operations; never issued to Commerce runtime.
- Commerce runtime credential: read/write only to `commerce_db`; cannot access `erp_db`.
- Future ERP command-adapter credential: separately approved, narrow stored/service operations, idempotent, audited; never general table write.
- Migration owners: ERP migrations/startup logic own ERP only; a future Commerce migration tool owns Commerce only.
- Backup/restore: independent schedules, encryption, retention and restore drills. Restoring Commerce cannot roll back ERP, and vice versa.
- Environments: development, test, staging and production have separate databases/credentials. No production clone enters lower environments without sanitization.

Initial mapping: one storefront equals one `company_scope_id` mapped server-side to one approved ERP company. Fulfilment policy references an internal branch opaquely; no branch data is public. Multi-company access requires scope in every unique constraint/query, service-derived tenant context, deny-by-default authorization, per-scope encryption/audit where warranted, and automated cross-company isolation tests.

