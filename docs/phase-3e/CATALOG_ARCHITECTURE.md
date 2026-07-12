# Catalogue Architecture

`src/features/catalog/` owns typed fixtures and reusable presentation primitives. `types.ts` defines collection, category, product, facts and media contracts; `data.ts` is the centralized synthetic fixture. Cards, media, grids, filter controls and the reusable listing composition remain independent of route files.

The App Router pages are thin server components. Dynamic collection, category and product routes use `generateStaticParams`, so the production build emits static HTML. The only Phase 3E client component is the product gallery selection control.

Catalogue screens include the shop landing, collection index, reusable collection/category listings, product grid, search empty/result states and a horizontally safe comparison shell. No fetching code, commerce state or persistence exists.
