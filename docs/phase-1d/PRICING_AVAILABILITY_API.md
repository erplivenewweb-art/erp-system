# Pricing and Availability API

Retail quotes are public but rate-limited. Wholesale and dealer-special quotes require an active approved dealer plus current price entitlement. Requests provide opaque variant IDs, quantities, channel and currency. Responses provide pricing type, decimal amounts, currency, safe tax display, MOQ/quantity breaks, approved promotional adjustments, provenance category, freshness and expiry.

Silver-rate and making-charge references are future optional safe inputs; sources, formulas, cost/margin and operational secrets are excluded. Quotes are immutable, actor-bound and cannot be used after expiry or entitlement change. Cart/order staging recalculates and requires explicit acceptance if totals change.

Availability exposes only `IN_STOCK`, `LOW_STOCK`, `MADE_TO_ORDER`, `OUT_OF_STOCK`, or `UNAVAILABLE`, plus `lastSyncedAt`, freshness and expiry. Exact quantity, barcode, branch and warehouse are suppressed. Fresh may be cached briefly; aging uses stale-while-revalidate conservatively; stale/outage returns UNAVAILABLE and blocks transactional promise. A future reservation returns only an opaque expiring reference.

