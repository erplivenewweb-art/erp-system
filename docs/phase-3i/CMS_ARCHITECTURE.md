# CMS Architecture

`src/features/cms/` owns shared navigation, shell, fixtures, dashboard and homepage manager. `admin/` owns reusable entity/configuration managers, `media/` owns the asset-library shell and `blog/` owns editorial presentation.

The 14-link CMS navigation covers Dashboard, Homepage, Products, Collections, Categories, Banners, Media, Blog, SEO, Navigation, Footer, Theme, Sections and Previews. All routes are Server Components and noindex/no-follow.

Controls are intentionally inert and future-integratable. No editor, upload or CMS dependency was introduced.
