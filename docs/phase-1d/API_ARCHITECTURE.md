# API Architecture

Clients call only the Commerce API. Storefront, customer, dealer, admin, mobile, marketplace and export clients never call ERP routes. Commerce holds no raw ERP database credentials. A private authenticated ERP Integration API is the sole future exchange boundary.

Public/customer/dealer/admin namespaces are channel-neutral contracts, not separate databases. Authorization derives actor, company/storefront and visibility server-side. The internal namespace is network-private, audience-bound and unavailable to browsers.

ERP owns stock, purity, weight, size, operational inventory, GST, billing, manufacturing, branches and invoices. Commerce owns safe catalogue/SEO/media/visibility, customer/dealer identity, cart/wishlist, applications, quotations, staged orders, payment attempts, shipping requests and notifications. Shared values are opaque references or expiring projections.

Public responses exclude ERP IDs, barcodes, exact inventory, cost, employee/accounting/manufacturing data and branch/company internals. Every integration response is translated into a customer-safe Commerce contract before channel delivery.

