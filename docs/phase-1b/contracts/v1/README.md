# Commerce Contracts V1

Status: planning contract, not a deployed API. Base path reserved as `/commerce/v1`; media type `application/vnd.commerce.v1+json`. This directory creates no route, service, database, credential, or ERP dependency.

## Contract inventory

The canonical JSON Schema defines Product, ProductVariant, ProductMedia, Collection, Category, InventoryAvailability, InventoryStatus, PriceQuote, RetailPrice, WholesalePrice, DealerSpecialPrice, PriceBreak, MOQRule, CustomerProfile, CustomerType, DealerProfile, DealerLevel, DealerCategory, ApprovalStatus, Quotation, QuotationStatus, CreditTerms, OrderChannel, PublishStatus, Visibility, Pagination, Sorting, Filtering, Search, AuditMetadata, ErrorResponse, SuccessResponse, RequestMetadata, ResponseMetadata, and VersionMetadata.

## Separation model

```text
Product design -> Variant -> Physical barcode inventory (ERP only)
               -> Availability cache -> Pricing quote
               -> Media -> SEO -> Publication
```

A Product is merchandising/design content. A ProductVariant is a sellable design option. Neither is a barcode or stock unit. Physical barcode inventory never appears in this contract. InventoryAvailability is a coarse, expiring ERP-derived projection. PriceQuote is contextual and expiring. ProductMedia, SEO data, PublishStatus, and Visibility are independent commerce-owned concerns.

## Ownership

ERP exclusively owns inventory, stock, physical barcode logic, weight, purity, size, manufacturing, GST, billing, branches, company isolation, operational orders/returns, and accounting. Commerce owns SEO, media, collections, homepage/CMS content, visibility, slugs, product stories, reviews, wishlist, customer-safe catalogue, and availability cache. Commerce may display ERP-derived safe projections but cannot author ERP facts.

B2C is first-class: retail prices, public catalogue, cart, wishlist, checkout orchestration, orders, tracking, returns projection, reviews, and customer account are anticipated by actor/channel/version metadata.

B2B is first-class in v1: dealer registration and GST verification references, approval, dealer level/category, wholesale visibility, MOQ, quantity breaks, special prices, quotation revisions, bulk/repeat orders, credit terms, history, and dealer analytics scopes are represented without treating dealers as retail roles.

## Field rules

- Required fields are declared in each schema `required` array. Optional fields must be omitted when unknown; `null` is allowed only where explicitly declared.
- Objects default to `additionalProperties: false`. Extensions use a future namespaced extension container introduced additively, not arbitrary fields.
- IDs are opaque, prefixed commerce identifiers. Clients must not parse them.
- Money and decimal quantities are strings, never floating-point JSON numbers. Currency is ISO 4217.
- Timestamps are RFC 3339 UTC date-times. Locale is BCP 47. Country fields, when added, use ISO 3166.
- Lists have explicit maximums. Public page size is 1–100. Search text is 1–200 characters.
- Exact stock, locations, barcodes, internal IDs, cost, formulas, employee information, accounting, and manufacturing details are forbidden.
- Server-side authorization always filters visibility and dealer entitlement; the client cannot request a broader scope.
- Quote expiry, MOQ, dealer approval, availability, GST, and operational acceptance must be revalidated server-side before order acceptance.

## Compatibility and extension

Compatible v1 changes may add optional properties, new endpoints, new error codes, new capabilities, or enum values where consumers use tolerant readers. They may not remove or rename fields, narrow accepted values, change units/meaning, make optional fields required, change ID interpretation, or expose protected domains. Enum consumers must handle unknown values safely. Breaking changes create v2 and run beside v1.

Every response carries VersionMetadata. Capability strings allow clients to discover optional behavior without guessing from schema versions. Deprecation uses `Deprecation`, `Sunset`, successor links, release notes, and a review-approved support window.

## Examples

- `examples/b2c-product.json`: public B2C catalogue, coarse availability, and retail quote.
- `examples/b2b-dealer-quotation.json`: approved dealer, MOQ/price breaks, credit terms, and quotation.
- `examples/error-response.json`: safe stable error envelope.

Examples are synthetic and contain no production or ERP identifiers.

