# SEO Architecture

CMS owns approved metadata; frontend supplies typed defaults/validation. Public routes generate unique title/description, canonical, robots, OpenGraph/social cards, breadcrumb hierarchy and eligible Product/Organization/Breadcrumb/Article/Video/FAQ JSON-LD matching visible content.

Sitemaps include only published canonical routes and partition products/content. Robots blocks private/dealer/admin/system/query areas but is not security. Facets default canonical/noindex; only curated landing facets become indexable. Search, cart, checkout, accounts, dealer routes and previews are noindex.

Pagination provides crawlable links where required. Slug changes create versioned permanent redirects with cycle/chain checks. Price/availability schema uses safe fresh facts only. SEO tests inspect rendered HTML, canonicals, status/redirects, sitemap, robots and structured-data parity.

