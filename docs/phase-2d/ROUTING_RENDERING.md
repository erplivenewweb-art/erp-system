# Routing and Rendering

## Route groups

Public: home, shop, collections, categories, product, search, manufacturing, workshop, about, wholesale, custom orders, blog, FAQ, contact, policies, order tracking.

Customer: register/login, profile, addresses, wishlist, cart, checkout, orders, returns, reviews, notifications.

Dealer applicant: registration and approval status. Approved dealer: dashboard, catalogue, bulk cart, quotations, custom enquiries, repeat orders, orders, credit terms and support.

System: not-found, global/route error, loading and maintenance. Admin/CMS is a separate future application.

## Rendering matrix

| Route | Mode | Cache/revalidation | Outage behavior |
|---|---|---|---|
| Home | ISR/static shell | 5 min + CMS tag invalidation | Approved stale content within TTL |
| Products/collections/categories | ISR | 5–15 min; entity tags | Content may stale safely; availability separate |
| Product detail | ISR + streamed dynamic islands | content 5 min; availability ≤5 min; price uncached/short quote | Hide/disable promise on stale operational facts |
| Search | SSR/streamed query shell | private/no shared result cache; safe search cache short | Useful error and curated discovery |
| Blog/CMS pages | SSG/ISR | publish-driven; 1 h fallback | Last published safe version |
| Cart/checkout/account/dealer | Dynamic SSR + Client interaction | private/no-store | Preserve draft; never public cache |
| Dealer catalogue/quotes | Dynamic SSR/streaming | private, actor-scoped, short client cache | Fail closed for price/entitlement |
| Order tracking | Dynamic SSR | private/no-store or public opaque-reference policy | Safe pending/support fallback |

Hydrate only search controls, galleries, carts/forms, account/dealer tools and interactive navigation. SEO-critical copy/products render as HTML. Streaming boundaries match independent content, never split a form’s required context.

