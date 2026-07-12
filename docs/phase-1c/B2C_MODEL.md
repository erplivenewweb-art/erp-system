# B2C Model

Retail identity uses a customer identity realm separate from dealer and ERP staff authentication. CustomerAccount links profile, addresses, sessions, consent and notification preferences. Guest carts may use an expiring anonymous subject; account attachment is an audited transition.

Retail carts contain ProductVariant references, quantity, immutable price snapshots and validation results. Before a future checkout/order transition, availability and the expiring PriceQuote must be revalidated. Orders use `WEBSITE_RETAIL`, preserve product/address/price/tax snapshots and never depend on mutable catalogue fields for history.

Wishlist, verified reviews, customer-safe tracking, return/refund request projection, coupons and campaigns are commerce concerns. Verified-buyer status is derived server-side from an eligible commerce order/ERP-safe confirmation and exposes neither order nor customer internal IDs.

