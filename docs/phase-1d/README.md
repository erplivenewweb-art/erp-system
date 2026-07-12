# Phase 1D — API, Service Boundaries and Integration Contracts

Status: complete design for manual review. **DESIGN ONLY — NOT RUNTIME.** Phase 2 is not started or authorized.

Only this directory was created. It contains no API server, storefront, UI, database connection, migration, credential, package dependency, route registration or ERP mutation.

## Canonical namespace

- `/commerce/v1/public/...` — anonymous customer-safe reads and constrained quote/estimate commands
- `/commerce/v1/customer/...` — authenticated B2C self-service
- `/commerce/v1/dealer/...` — dealer applicant and approved-dealer resources
- `/commerce/v1/admin/...` — commerce workforce/CMS administration
- `/internal/v1/...` — private service-to-service ERP Integration boundary

The convention makes audience and authorization review visible in the path, isolates internal policy, allows independent major-version lifecycles, and prevents accidental reuse of existing ERP routes.

Canonical machine-readable artifact: `api/endpoint-catalog.json` with 148 endpoints and 48 schemas. Every endpoint contains method, path, purpose, auth level, request/response/error schema, rate class, permissions, idempotency, caching and company-scope rules.

