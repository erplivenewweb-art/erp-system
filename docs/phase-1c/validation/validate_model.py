"""Static Phase 1C model validation. Design-only; no network, DB, or ERP access."""
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "model" / "commerce-entity-catalog.json"
REQUIRED_META = {
    "purpose", "owning_system", "table_entity_name", "primary_key_strategy",
    "public_identifier_strategy", "important_fields", "required_fields",
    "optional_fields", "enum_status_fields", "foreign_key_relationships",
    "unique_constraints", "important_indexes", "lifecycle",
    "soft_delete_archive_behavior", "audit_requirements",
    "sensitive_data_classification", "erp_relationship", "applicability",
    "tenant_scope",
}
REQUIRED_ENTITIES = set("""
CustomerAccount CustomerProfile CustomerType CustomerAddress CustomerSession CustomerConsent
DealerAccount DealerProfile DealerApplication DealerBusinessAddress DealerDocumentReference DealerApprovalHistory DealerLevel DealerCategory DealerPriceListAssignment DealerCreditTerms DealerStatus
Product ProductVariant ERPProductReference ERPVariantReference ProductMedia ProductVideo ProductAttribute ProductOption ProductSEO ProductStory ProductCareGuide ProductPackagingInfo ProductPublication ProductVisibility Category Collection ProductCategoryLink ProductCollectionLink RelatedProduct FeaturedProduct HomepageSection Banner FestivalCampaignContent
InventoryAvailability AvailabilitySnapshot AvailabilitySource AvailabilityFreshness AvailabilityStatus ReservationReference AvailabilityAudit
PriceList PriceListVersion PriceRule RetailPrice WholesalePrice DealerSpecialPrice QuantityPriceBreak MOQRule PriceQuote PriceQuoteLine PriceValidity TaxDisplayRule MakingChargeRule MetalRateReference PromotionalPrice CouponPriceAdjustment
Cart CartItem CartPriceSnapshot CartValidation Wishlist WishlistItem
Quotation QuotationItem QuotationStatus QuotationRevision QuotationApproval QuotationPriceSnapshot CustomOrderRequest CustomOrderDesignReference CustomSizeRequest CustomOrderStatus CustomerMessageThreadReference
CommerceOrder CommerceOrderItem OrderAddressSnapshot OrderPriceSnapshot OrderTaxSnapshot OrderStatus OrderChannel OrderPaymentStatus OrderFulfilmentStatus OrderHistory OrderNote ERPOrderReference ERPInvoiceReference OrderIdempotencyKey OrderFailureRecord OrderConversionAttempt
PaymentAttempt PaymentTransaction PaymentProvider PaymentWebhookEvent PaymentIdempotencyKey PaymentStatus RefundRequest RefundTransaction CODConfiguration PaymentFailure
Shipment ShipmentItem ShippingAddressSnapshot ShippingProvider ShippingRateQuote ShippingLabelReference TrackingEvent PackingStatus DispatchStatus DeliveryStatus ReturnShipmentReference
ProductReview ReviewMedia ReviewVerification ReviewModeration ReviewStatus ManufacturerStory WorkshopContent ArtisanContent TrustBadge PurityPromise PackagingContent
CMSPage CMSSection CMSVersion MediaAsset MediaVariant MediaUsage SEOPage RedirectRule BlogPost BlogCategory FAQ NavigationMenu FooterLink Announcement CampaignLandingPage
Coupon CouponRule Campaign ReferralCode NewsletterSubscription MarketingConsent NotificationPreference LoyaltyAccount LoyaltyTransaction GiftCard AbandonedCartReference
CommerceEvent AuditLog CustomerActivity DealerActivity OrderAnalyticsProjection ProductAnalyticsProjection CampaignAttribution SearchEvent AvailabilitySyncLog PriceQuoteAudit IntegrationAttemptLog
""".split())
REQUIRED_CONCEPTS = {
    "CustomerType", "OrderChannel", "DealerLevel", "DealerCategory",
    "DealerApprovalHistory", "QuotationStatus", "DealerCreditTerms", "MOQRule",
    "QuantityPriceBreak", "ProductVisibility",
}
FORBIDDEN_PUBLIC_FIELDS = {
    "erp_auto_increment_id", "physical_barcode", "exact_stock_quantity",
    "internal_cost", "manufacturing_secret", "erp_jwt", "erp_employee_id",
    "branch_internal_id", "accounting_ledger",
}


def main() -> int:
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    failures = []
    if not data.get("design_only") or not data.get("do_not_execute"):
        failures.append("catalogue must be explicitly design-only and non-executable")
    entities = data.get("entities", [])
    relationships = data.get("relationships", [])
    by_name = {item.get("name"): item for item in entities}
    if len(by_name) != len(entities):
        failures.append("duplicate entity names")
    missing = sorted(REQUIRED_ENTITIES - by_name.keys())
    extra_missing = sorted(REQUIRED_CONCEPTS - by_name.keys())
    if missing:
        failures.append("missing required entities: " + ", ".join(missing))
    if extra_missing:
        failures.append("missing B2C/B2B concepts: " + ", ".join(extra_missing))

    for name, entity in by_name.items():
        absent = sorted(REQUIRED_META - entity.keys())
        if absent:
            failures.append(f"{name}: missing metadata {', '.join(absent)}")
        if not entity.get("owning_system"):
            failures.append(f"{name}: owner is empty")
        fields = set(entity.get("important_fields", []))
        if fields & FORBIDDEN_PUBLIC_FIELDS:
            failures.append(f"{name}: forbidden sensitive fields {sorted(fields & FORBIDDEN_PUBLIC_FIELDS)}")
        if "ERP" in entity.get("owning_system", "") and "projection" not in entity.get("owning_system", "").lower():
            failures.append(f"{name}: possible ERP ownership conflict")
        erp_text = entity.get("erp_relationship", "").lower()
        if "write erp tables directly" in erp_text and "never" not in erp_text:
            failures.append(f"{name}: direct ERP write path")
        if not entity.get("public_identifier_strategy"):
            failures.append(f"{name}: public ID strategy missing")
        if entity.get("applicability") not in {"B2C", "B2B", "B2C_AND_B2B"}:
            failures.append(f"{name}: invalid applicability")

    seen_rel = set()
    for rel in relationships:
        key = (rel.get("from"), rel.get("to"), rel.get("field"))
        if key in seen_rel:
            failures.append(f"duplicate relationship: {key}")
        seen_rel.add(key)
        if rel.get("from") not in by_name:
            failures.append(f"relationship source missing: {rel.get('from')}")
        if rel.get("to") not in by_name:
            failures.append(f"relationship target missing: {rel.get('to')}")
        if "cross-database" not in rel.get("enforcement", ""):
            failures.append(f"relationship lacks ERP separation rule: {key}")

    required_channels = {"WEBSITE_RETAIL", "WEBSITE_WHOLESALE", "MOBILE_RETAIL",
                         "MOBILE_WHOLESALE", "MARKETPLACE", "MANUAL_COMMERCE"}
    channels = set(by_name["OrderChannel"]["enum_status_fields"][0]["values"])
    if not required_channels <= channels:
        failures.append("order channels incomplete")
    statuses = set(by_name["AvailabilityStatus"]["enum_status_fields"][0]["values"])
    if not {"IN_STOCK", "LOW_STOCK", "MADE_TO_ORDER", "OUT_OF_STOCK", "UNAVAILABLE"} <= statuses:
        failures.append("availability statuses incomplete")

    if failures:
        for item in failures:
            print(f"FAIL: {item}", file=sys.stderr)
        return 1
    print(f"PASS: {len(entities)} entities, {len(relationships)} relationships, all required metadata and boundaries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

