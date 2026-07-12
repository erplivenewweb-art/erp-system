# Entity Catalogue

The canonical per-entity specification is `model/commerce-entity-catalog.json`. It is database-neutral and marked `design_only: true` and `do_not_execute: true`.

## Universal conventions

Mutable aggregates use internal UUID/ULID keys, separate prefixed opaque public identifiers, `company_scope_id`, UTC `created_at`/`updated_at`, integer `version`, optimistic compare-and-swap, status, and optional `archived_at`. Public IDs are never ERP auto-increment IDs. Money uses decimal values with ISO 4217 currency. Important workflows use append-only history or immutable snapshots.

Commerce-only relationships use database FKs. ERP mappings use opaque contract references without cross-database FKs. Deleting an account anonymizes eligible personal data after policy holds; financial, security, consent and workflow evidence is retained or pseudonymized under approved policy.

## Domain inventory

- Identity and Accounts: 17 entities
- Catalogue and Merchandising: 23
- Availability and Inventory Projection: 7
- Pricing: 16
- Cart and Wishlist: 6
- Quotations and Custom Orders: 11
- Orders: 16
- Payments and Refunds: 10
- Shipping and Fulfilment: 11
- Reviews and Trust: 11
- CMS, SEO and Media: 15
- Marketing and Loyalty Readiness: 11
- Analytics and Audit: 11

Total: 165 entities. Future-only designs are explicitly dormant: ReservationReference, MakingChargeRule, MetalRateReference, ReferralCode, LoyaltyAccount, LoyaltyTransaction, GiftCard, and AbandonedCartReference.

## Integrity rules

Duplicate dealer submissions are prevented by normalized legal identity/GST fingerprint plus active-application constraints. Provider webhook identity is unique by provider and event ID. ERP conversion is unique by commerce order and idempotency key. Price-list versions cannot overlap for the same assignment unless policy explicitly permits precedence. Workflow histories are append-only. Snapshots remain readable after source records are archived.

