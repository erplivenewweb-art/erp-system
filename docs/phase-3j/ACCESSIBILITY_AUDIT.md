# Accessibility Audit

WCAG 2.2 AA foundations pass automated and live review: semantic root landmarks, skip link, one stable H1 per route, ordered heading hierarchy, labelled forms, native choices/disclosures, accessible tables, named navigation, status/alert states, 44px controls and visible focus.

Native dialogs and drawers trap focus through modal browser behavior, support Escape and restore focus. Final live modal verification restored focus to `Open modal` with a solid outline. Mobile account/dealer/CMS navigation and wide tables scroll internally without page overflow.

Reduced-motion overrides exist globally and at interactive component level. Automated axe suites cover homepage/shell, catalogue/product, cart/checkout, account/profile, dealer and CMS. JSDOM color contrast is disabled because it cannot resolve rendered CSS custom properties; token colors were visually reviewed.

Transient development loading markup can briefly coexist during rapid automated navigation; every flagged route stabilized to exactly one H1 after route completion.
