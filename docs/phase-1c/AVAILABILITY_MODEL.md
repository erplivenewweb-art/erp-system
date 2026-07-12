# Availability Model

ERP owns physical stock. Commerce owns only a customer-safe cache keyed by company scope, variant and fulfilment scope. Public statuses are `IN_STOCK`, `LOW_STOCK`, `MADE_TO_ORDER`, `OUT_OF_STOCK`, `UNAVAILABLE`, and internal-safe fallback `UNKNOWN`. Exact stock, barcode, branch and warehouse data are excluded.

Every projection records source, source version, `last_synced_at`, `expires_at`, freshness status, last successful sync, correlation ID and safe failure code. Freshness is `FRESH`, `AGING`, `STALE` or `UNAVAILABLE`.

Recommended failure behavior:

- Fresh: display mapped status; still revalidate before conversion.
- Aging: display conservative status with no urgency claims; trigger refresh.
- Stale: return UNKNOWN/UNAVAILABLE, disable transactional promise and queue retry.
- Integration/ERP downtime: serve safe catalogue content but fail closed for order validation; never infer inventory from old quantities.

ReservationReference is future-only and stores only an opaque adapter reference, expiry and state. It is not stock ownership and authorizes no implementation.

