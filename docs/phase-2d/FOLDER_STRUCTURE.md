# Future Storefront Folder Architecture

**Blueprint only; do not create this tree before Phase 3A approval.**

```text
storefront/
  app/
    (public)/              routes and public layout
    (customer)/            protected customer layout/routes
    (dealer-apply)/        applicant routes
    (dealer)/              approved-dealer routes
    api/                   storefront BFF endpoints only when justified
    _errors/               global/route error UI
  features/
    catalogue/ search/ wishlist/ cart/ checkout/
    customer-account/ dealer-application/ dealer-catalogue/
    quotations/ orders/ reviews/ custom-orders/
  components/
    primitives/            low-level accessible controls
    shared/                cross-domain composed UI
    commerce/              product/price/availability/order
    sections/              CMS/page sections
  core/
    auth/ api/ config/ errors/ observability/ security/
  state/                   scoped client stores only
  forms/                   shared form adapters/schema mappings
  styles/                  reset, globals, layouts, print
  themes/                  light, dark, festival mappings
  tokens/                  generated outputs; canonical source elsewhere
  assets/ icons/ fonts/
  media/                   loaders/placeholders, not binary masters
  i18n/ analytics/ utils/
  mocks/ fixtures/
  tests/
    unit/ component/ contract/ integration/ e2e/
    accessibility/ visual/ performance/ seo/
  public/                  approved small immutable assets only
```

Feature folders own domain UI, queries, mutations, schemas, tests and fixtures. `core` contains infrastructure without domain presentation. Shared components require two proven consumers; otherwise remain feature-local. No giant global component or utility folder.

