# Decision Index

| Decision | Outcome | Primary source |
|---|---|---|
| ERP boundary | Protected; no commerce direct DB/routes/auth | Phase 1A |
| Repository/deployment | Commerce/storefront/addapters isolated | ADR-001/002/027 |
| Identity | Customer, dealer, ERP employee and workload separated | ADR-005–008 |
| Product/inventory/pricing | ERP operational truth; Commerce safe projection/quote | ADR-010–012; Phase 1C |
| B2C/B2B | First-class from v1 | ADR-016/017 |
| Orders/payments/shipping | Commerce intent/projection; ERP/provider operations | ADR-020–022 |
| API namespace | Commerce audience groups + private internal v1 | Phase 1D |
| API versioning | Major path + additive semantic schemas | ADR-009; Phase 1D |
| Database | Separate ERP/Commerce schemas, credentials, migrations/backups | Phase 1C |
| Brand | Manufacturer-led quiet evidence-based luxury | Phase 2A |
| Accessibility | WCAG 2.2 AA release gate | Phases 2A–2D |
| Visual system | Semantic Ink/Ivory/Silver/Vermilion; tokenized themes | Phase 2C |
| Frontend stack | Next.js App Router + React + TypeScript | Phase 2D |
| Styling | CSS Modules + generated semantic CSS variables | Phase 2D |
| Admin/CMS frontend | Separate future application | Phase 2D |
| Rendering | Hybrid static/ISR/SSR/streaming by route | Phase 2D |
| State | Server authoritative; narrow reversible client state | Phase 2D |
| Performance | CWV and explicit bundle/media/font budgets | Phase 2D |
| Phase 3 | Isolated scaffold first; ten gated subphases | Phase 2D |

