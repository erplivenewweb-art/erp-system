# Relationships and Referential Integrity

The canonical catalogue lists 118 directed relationships with cardinality and enforcement.

## Aggregate boundaries

- CustomerAccount owns profile, addresses, sessions, consent, retail carts/wishlists and B2C orders.
- DealerAccount owns business profile, applications, addresses, approval history, price-list assignments, credit terms, dealer carts, quotations and B2B orders.
- Product owns merchandising; ProductVariant owns option identity. ERPProductReference and ERPVariantReference are opaque mappings only.
- InventoryAvailability and AvailabilitySnapshot are disposable projections attached to variants.
- PriceList has immutable PriceListVersion children; rules, prices, MOQ and breaks bind to versions/variants and actor eligibility.
- Quotation has immutable revisions and price snapshots; CommerceOrder has immutable item/address/price/tax snapshots and append-only history.
- PaymentAttempt, Shipment and ERPOrderReference attach to CommerceOrder without taking ownership of ERP accounting or inventory.

## Referential behavior

Mutable commerce FKs use restrict-by-default; owned ephemeral children may cascade archive. Immutable snapshots and audit/history use restrict and retain opaque public references. Personal records use policy-driven anonymization, not blind cascading deletion. No relationship crosses into the ERP database. External/provider and ERP identifiers are opaque, encrypted or hashed where appropriate, and unique only within source-system scope.

