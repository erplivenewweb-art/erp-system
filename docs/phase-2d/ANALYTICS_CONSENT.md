# Analytics and Consent

Map the 144 Phase 2B page events into a governed catalogue: `domain_object_action`, owner, trigger, client/server source, properties, consent class, retention and test. Page impressions/interactions may be client events; accepted orders/payments/integration outcomes are server events. Event ID and order/quote reference deduplicate.

Google Analytics and Meta Pixel are readiness adapters only, not selected. Nonessential SDKs load after consent and remain budgeted/sandboxed. Marketing opt-in is separate from analytics consent.

Exclude names, email, phone, address, GST, document/payment data, search terms with PII, ERP IDs/barcodes, branch/company internals, wholesale price values and free-form messages. Dealer analytics is organization-scoped commerce-safe aggregation. Attribution is bounded and consent-aware. Search/funnel analytics uses pseudonymous IDs and approved short retention.

