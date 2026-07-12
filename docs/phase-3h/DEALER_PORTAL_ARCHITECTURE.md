# Dealer Portal Architecture

`src/features/b2b/` owns the semantic token-driven styles, typed navigation/content fixtures and shared DealerShell. `dealer/` owns public/access/dashboard-family presentations; `quotation/` and `bulk-order/` isolate their workflows.

The public `/wholesale` route is indexable. Twelve dealer-oriented routes are static and noindex/no-follow. The portal navigation contains Dashboard, Catalogue, Quotations, Bulk order, Orders, Pricing & terms, KYC, Downloads and Support plus a logout placeholder.

All Phase 3H screens are Server Components and introduce no dependency or client-side storage.
