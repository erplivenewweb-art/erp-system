# Route Inventory

Page-module count: 47. Page-module inventory SHA-256: `915c57e6df8d03b159da81b83f13bf661ddc37eb1b6f2b47fd492d1c78c30712`.

Concrete audited URL count: 60. Ordered concrete-route SHA-256: `22db4c72b5c8977cf98d33779d4fd9fa4fdb2d7fcf793e46dabc8f88c7ce09d5`. Production build generates 61 pages including framework not-found output.

## Public and commerce

`/`, `/shop`, `/collections`, `/collections/silver-sankha`, `/collections/silver-pola`, `/collections/custom-orders`, `/collections/wholesale`, `/collections/gift-collection`, `/collections/new-arrivals`, `/category/sankha`, `/category/pola`, `/category/ceremonial-pairs`, `/product/sankha-form-01`, `/product/sankha-form-02`, `/product/pola-form-01`, `/product/pola-form-02`, `/product/ceremonial-pair-01`, `/product/ceremonial-pair-02`, `/search`, `/compare`, `/wishlist`, `/cart`, `/checkout`, `/order-success`, `/orders`, `/wholesale`, `/design-system`, and arbitrary missing URLs through not-found.

## Customer

`/account`, `/account/orders`, `/account/orders/sample-order`, `/account/addresses`, `/account/profile`, `/account/security`, `/account/notifications`.

## Dealer

`/dealer`, `/dealer/register`, `/dealer/login`, `/dealer/quotations`, `/dealer/bulk-order`, `/dealer/catalogue`, `/dealer/pricing`, `/dealer/kyc`, `/dealer/orders`, `/dealer/downloads`, `/dealer/support`.

## CMS

`/cms`, `/cms/homepage`, `/cms/products`, `/cms/collections`, `/cms/categories`, `/cms/banners`, `/cms/media`, `/cms/blog`, `/cms/seo`, `/cms/navigation`, `/cms/footer`, `/cms/theme`, `/cms/sections`, `/cms/preview`.

## App Router infrastructure

`layout.tsx`, `loading.tsx`, `error.tsx`, `global-error.tsx`, `not-found.tsx`; dynamic modules: `category/[slug]`, `collections/[slug]`, `product/[slug]`, `account/orders/[slug]`.
