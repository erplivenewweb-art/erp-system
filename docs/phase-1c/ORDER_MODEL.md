# Order Model

CommerceOrder owns customer intent and historical customer-visible snapshots. ERP owns operational order acceptance, inventory allocation, billing, GST, invoice, fulfilment and returns.

Channels are `WEBSITE_RETAIL` and `WEBSITE_WHOLESALE` from day one; reserved additive channels are `MOBILE_RETAIL`, `MOBILE_WHOLESALE`, `MARKETPLACE`, and `MANUAL_COMMERCE`.

Each item snapshots product/variant public identity, description, option labels, quantity and quoted amount. OrderAddressSnapshot, OrderPriceSnapshot and OrderTaxSnapshot are immutable. Status changes append OrderHistory. Corrections create compensating records rather than rewriting history.

Conversion uses a unique OrderIdempotencyKey, compare-and-swap state, append-only OrderConversionAttempt and one active ERPOrderReference. Retries reuse the same key. The future adapter maps safe commands and returns opaque ERP order/invoice references; there is no direct billing, stock, invoice or ERP table write.

