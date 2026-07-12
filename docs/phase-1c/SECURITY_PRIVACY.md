# Security and Privacy

Identity realms are separate: retail customer, dealer organization/user, commerce administration, service integration and ERP employee. ERP JWTs/cookies/roles are rejected by commerce audiences; commerce tokens are rejected by ERP.

## Excluded from public contracts

ERP/internal row IDs, physical barcodes, exact stock, branch or warehouse details, company internals, internal cost/margin/formulas, manufacturing/process secrets, staff identity/roles, ERP credentials, accounting/ledger data, raw dealer documents, payment credentials, webhook secrets, unrestricted addresses, internal order/customer IDs, SQL and stack traces.

## Classification and controls

Public merchandising requires publication/visibility approval. Internal projections require service authorization. PII and dealer evidence are confidential, encrypted in transit/at rest, field-access audited and minimized. Secrets never enter ordinary tables or logs. Provider references are opaque; event payload retention is minimized.

Account deletion deactivates identity immediately, revokes sessions and begins policy-driven erasure/anonymization. Orders, invoices, tax, payment, fraud, consent and approval evidence may have statutory/security holds; retention duration requires legal approval. Analytics uses pseudonymous rotating identifiers, aggregation, consent gates and deletion propagation. Search/query data is truncated or anonymized under a short approved retention.

