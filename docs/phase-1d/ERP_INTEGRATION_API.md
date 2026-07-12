# Private ERP Integration API

15 private endpoints cover health/capabilities, catalogue projections, opaque product/variant references, customer-safe availability, approved price references, ERP order/invoice references and dispatch/tracking projection.

The following are **FUTURE — NOT IMPLEMENTED**:

- `POST /internal/v1/reservations`
- `DELETE /internal/v1/reservations/{reservationRef}`
- `POST /internal/v1/order-conversions`

The service is network-private, unavailable to browsers, authenticated with workload identity or mTLS plus short-lived audience-bound tokens. Read credentials are least-privilege and adapter-owned; Commerce never receives them. A future command credential is separately approved, narrow, idempotent and audited—never general SQL/table write.

Internal references are opaque and source-scoped. The adapter derives company/branch scope server-side and rejects client-supplied escalation. Results are translated/redacted before Commerce stores projections.

