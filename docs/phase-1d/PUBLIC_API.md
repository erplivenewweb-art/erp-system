# Public Storefront API

23 endpoints cover home, navigation, collections, categories, product lists/details/media/related items, search, filters, sorting, availability, retail quotes, reviews, FAQs, blog/guides, CMS pages, contact/WhatsApp configuration, delivery estimates and capability discovery.

GET responses are publication- and visibility-filtered before caching. ETags and surrogate keys permit safe invalidation. Search accepts a maximum query length, allowlisted filters/sorts and cursor pagination. Field expansion is denied by default except documented safe expansions.

Availability returns only status, freshness and timestamps. Retail quotes are short-lived, actor/channel/currency scoped and recalculated before order staging. Contact configuration returns approved public values only—never provider credentials. Delivery estimates are explicitly non-binding and suppress branch/warehouse identity.

