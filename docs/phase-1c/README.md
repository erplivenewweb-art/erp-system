# Phase 1C — Commerce Data Model and Ownership Blueprint

Status: Complete design for manual review. **Planning only. Phase 1D is not started or authorized.**

This directory is the only Phase 1C change. It contains no executable migration, SQL DDL, runtime service, storefront, API route, database connection, credential, package change, or ERP write path.

## Canonical outputs

- `model/commerce-entity-catalog.json`: database-neutral design catalogue with 165 entities and 118 validated relationships. Every entity records purpose, owner, table name, key/public-ID strategy, fields, required/optional fields, enums, relationships, constraints, indexes, lifecycle, archive behavior, audit, sensitivity, ERP relationship, applicability, and tenant scope.
- `ENTITY_CATALOG.md`: catalogue conventions and domain inventory.
- `DATA_OWNERSHIP.md`: source-of-truth matrix and prohibited duplication.
- Domain documents cover B2C, B2B, catalogue relationships, pricing, availability, orders, payments/shipping, CMS/media, security/privacy, and database boundaries.
- `diagrams/`: ten text-based Mermaid architecture/data diagrams.
- `validation/validate_model.py`: offline static checks only.

## Foundational rule

```text
Product design -> Sellable variant -> Opaque ERP reference
               -> Physical barcode units (ERP only)
               -> Coarse availability projection -> Expiring price quote
```

Commerce never owns physical inventory, ERP product rows, weight/purity/size operational facts, GST, billing, invoices, returns, stock movements, branches, companies, manufacturing/process, offline sales, or ERP employee identity.

## Initial deployment recommendation

One storefront maps to exactly one approved ERP company through a server-side `company_scope_id` mapping. One online fulfilment policy is configured for that scope, but its ERP branch reference and allocation details remain restricted and are never returned publicly. Multi-brand/multi-company readiness is preserved through mandatory scoping; cross-company queries are deny-by-default.

