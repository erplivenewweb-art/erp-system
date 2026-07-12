# Service Boundaries

| Boundary | Responsibilities | Forbidden |
|---|---|---|
| Storefront/mobile/dealer clients | Render, collect user intent, hold no secrets | ERP calls, price calculation, authorization decisions |
| Commerce API | Channel contracts, actor policy, orchestration, snapshots | ERP credentials, direct ERP SQL, staff JWT acceptance |
| Commerce identity | Customer/dealer/admin sessions and consent | ERP employee identity reuse |
| Commerce CMS/media | Content, publication, SEO, asset metadata | Raw binary in MySQL, unsafe HTML |
| Commerce workers | Notifications, projections, retries, webhooks | Unbounded retries, cross-company work |
| ERP Integration API | Translate approved projections/commands | Public exposure, general database CRUD |
| Existing ERP | Operational source of truth | Commerce schema ownership |

Each deployable has separate identity, credentials, health, rate policy, logs and rollback. Correlation IDs cross boundaries; raw tokens, PII and internal identifiers do not.

