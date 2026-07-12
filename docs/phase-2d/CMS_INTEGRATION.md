# CMS Integration Blueprint

Typed CMS modules cover logo references, hero/category/festival banners, homepage sections, merchandising product projections, collections, media, blogs, FAQs, policies, announcements, dealer content and SEO. Owner edits structured fields without code.

Frontend fetches only published content by audience/locale/company. Draft preview uses signed short-lived preview session, separate noindex route/cookie, cache bypass and prominent banner. Dealer preview requires workforce permission and never public-cache. Scheduling/publishing emits tag invalidation; rollback selects a prior immutable version.

Module registry validates required fields, allowed components, media rights/crops/alt/captions, links, accessibility, SEO and performance estimate. Unknown module versions fail safely without breaking the page. ERP-derived facts are locked/non-editable.

