# Commerce Admin and CMS API

42 endpoints cover merchandising projections, publication, SEO, taxonomy, product media, hero/category/festival banners, homepage sections, blogs, FAQs, policies, review moderation, coupons, campaigns, dealer decisions/classification/price lists and audit search.

Admin authentication is a commerce workforce trust domain, not ERP staff JWT reuse. Permissions are granular: content edit, publish, SEO, media, moderation, campaign, dealer-review, dealer-pricing and audit-read. High-risk dealer decisions and price assignments require step-up or dual approval where policy selects it.

Inputs are field-allowlisted. Rich content is sanitized on write and output with a restrictive CSP. Publication uses optimistic concurrency, scheduled-state validation and append-only audit. Admin APIs never mutate ERP products, prices, stock or branches.

