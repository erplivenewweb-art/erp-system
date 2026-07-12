# Public Layout

The root layout composes a skip link, `PublicHeader`, one stable `main#main-content`, and `PublicFooter`. Existing semantic layout tokens provide the content width, readable measure, gutters, touch sizes and responsive spacing. The Phase 3A scaffold and Phase 3B design-system route both render inside this shell without becoming public content pages.

The header is sticky and full-width. The footer is server-rendered. Only drawer state and focus management require a client boundary. No external font, analytics, API or heavy UI package was added.

CMS readiness is represented by typed navigation/footer fixture data and a replaceable text logo placeholder. It is not a CMS integration.

