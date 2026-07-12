# Payment and Shipping Model

Planning only; no provider is selected or integrated.

PaymentAttempt represents an intended amount/method. PaymentTransaction records provider-safe state transitions. Provider event uniqueness is enforced by `(provider_id, provider_event_id)`; payload digests detect mutation and raw payload retention is minimized. Signed webhooks enter an inbox, transition monotonically and are idempotent. Card/UPI credentials are never stored. Supported future methods include UPI, cards, net banking, wallets, COD, approved dealer credit and explicitly authorized partial payments.

RefundRequest is commerce workflow intent; RefundTransaction is provider projection. ERP remains authoritative for accounting and return eligibility. CODConfiguration is scoped policy, not a guarantee.

Shipment supports multiple packages and item allocation. ShippingAddressSnapshot is immutable. Labels are opaque object/provider references. TrackingEvent maps provider states to customer-safe packing, dispatch and delivery enums, including failure and return-to-origin. Internal branch/warehouse identity is restricted. Export fields remain additive and dormant pending legal/logistics approval.

