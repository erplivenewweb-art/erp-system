# Phase 1B — Architecture Decisions and Commerce Contracts

Status: Complete for manual review. Planning and contracts only. Phase 1C is not started or authorized.

This phase is contained entirely under `docs/phase-1b/`. It adds no runtime, storefront, checkout, payment, shipping implementation, route, database object, migration, ERP integration, dependency, package script, environment value, service-worker behavior, or deployment configuration.

## Deliverables

- `adrs/`: 30 accepted architecture planning records, each with Context, Problem, Decision, Alternatives, Consequences, and Future impact.
- `contracts/v1/schema/commerce-contracts.schema.json`: canonical JSON Schema Draft 2020-12 contract with 35 requested definitions.
- `contracts/v1/examples/`: synthetic B2C, B2B, and safe error payloads.
- `contracts/v1/validation/`: isolated offline parsing, definition, schema-subset, example, and sensitive-field validation.
- `contracts/v1/README.md`: ownership, separation, validation, limits, and extension rules.
- `contracts/v1/COMPATIBILITY.md`: additive-change and breaking-change policy.
- `SECURITY.md`: explicit sensitive-field exclusion boundary.
- `OPEN_DECISIONS.md`: decisions requiring approval before implementation.

## ADR inventory

1. ADR-001 — Repository Boundaries
2. ADR-002 — Storefront Isolation
3. ADR-003 — Commerce API Responsibilities
4. ADR-004 — ERP Integration API Responsibilities
5. ADR-005 — Customer Identity Isolation
6. ADR-006 — Dealer Identity Isolation
7. ADR-007 — ERP Employee Identity Isolation
8. ADR-008 — API Authentication Strategy
9. ADR-009 — API Versioning Strategy
10. ADR-010 — Product Ownership
11. ADR-011 — Inventory Ownership
12. ADR-012 — Pricing Ownership
13. ADR-013 — SEO Ownership
14. ADR-014 — Media Ownership
15. ADR-015 — CMS Ownership
16. ADR-016 — B2C Architecture
17. ADR-017 — B2B Architecture
18. ADR-018 — Dealer Approval Workflow
19. ADR-019 — Quotation Workflow
20. ADR-020 — Order Ownership
21. ADR-021 — Payment Ownership
22. ADR-022 — Shipping Ownership
23. ADR-023 — Analytics Ownership
24. ADR-024 — Event and Audit Model
25. ADR-025 — Error Handling
26. ADR-026 — Rate Limiting
27. ADR-027 — Deployment Boundaries
28. ADR-028 — Future Mobile App Architecture
29. ADR-029 — Marketplace Integration Strategy
30. ADR-030 — Export Readiness

## Contract inventory

Product; ProductVariant; ProductMedia; Collection; Category; InventoryAvailability; InventoryStatus; PriceQuote; RetailPrice; WholesalePrice; DealerSpecialPrice; PriceBreak; MOQRule; CustomerProfile; CustomerType; DealerProfile; DealerLevel; DealerCategory; ApprovalStatus; Quotation; QuotationStatus; CreditTerms; OrderChannel; PublishStatus; Visibility; Pagination; Sorting; Filtering; Search; AuditMetadata; ErrorResponse; SuccessResponse; RequestMetadata; ResponseMetadata; VersionMetadata.

## Safety result

Phase 1A fingerprints were recomputed before work and matched exactly: 252 ordered routes, 69 startup-created tables, and every protected file hash. The pre-existing dirty files remain present and untouched. Only new files under this directory were created.

Rollback is deletion of `docs/phase-1b/` only. Never reset, restore, stage, reformat, or alter the pre-existing dirty tree.

