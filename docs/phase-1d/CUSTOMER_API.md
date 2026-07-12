# B2C Customer API

29 endpoints cover registration, login/logout/refresh/reset, profile, addresses, consent/preferences, wishlist, retail cart, validation, checkout preview, future staged order creation, order history/detail/tracking, return/refund request and review submission.

Customer resources are subject-bound: a path ID never grants access. Address and profile inputs use allowlists to prevent mass assignment. Cart changes use optimistic version checks; validation refreshes price and availability. Checkout preview creates no order, payment, reservation or ERP write.

Future order creation requires `Idempotency-Key`, current price/availability validation, immutable product/address/price/tax snapshots and explicit consent. Tracking and review verification use opaque order references internally; customer/order internal IDs are never exposed to other users.

