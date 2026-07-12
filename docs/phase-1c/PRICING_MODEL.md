# Pricing Model

## Authority

Price lists/rules are commerce-managed presentation and eligibility data only where approved. An immutable, expiring PriceQuote is the authoritative commerce transaction offer for its actor, quantities, currency and time window. ERP remains authoritative for GST, billing and final operational acceptance. Internal cost, margins and formula inputs are never exposed.

## Resolution precedence

1. Resolve company, storefront, currency, channel and authenticated actor.
2. Public actors receive eligible RETAIL rules only.
3. Approved dealers resolve assignment, WHOLESALE list, level/category and optional DEALER_SPECIAL override.
4. Apply validity window, MOQ and highest eligible quantity break.
5. Apply approved promotion/coupon without exposing rule internals.
6. Request authoritative tax/GST and operational validation through a future ERP contract.
7. persist PriceQuote plus immutable lines, provenance digest, expiry and audit.

Types: RETAIL, WHOLESALE, DEALER_SPECIAL, PROMOTIONAL and COUPON_ADJUSTMENT. Price versions are immutable after activation. Overlapping rules require explicit priority and conflict validation.

Silver-rate references and making-charge rules are future-only. Their authority, source, units, rounding, lock time, fallback and GST interaction require finance approval. Export uses decimal values, ISO 4217 currencies and explicit rate provenance.

