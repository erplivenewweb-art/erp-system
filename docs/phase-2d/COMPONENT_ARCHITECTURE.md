# Component Architecture

| Layer | Owner/reuse | Contract and quality |
|---|---|---|
| Design primitives | Design system | Token-only spacing/type/color/icon rules; no domain logic |
| UI primitives | Shared UI | Accessible button/input/dialog/table primitives; stable typed props |
| Shared composed | Shared UI | Header, footer, search shell, form field; requires ≥2 consumers |
| Commerce domain | Domain feature | ProductCard, PriceBlock, Availability, Gallery, OrderTimeline |
| B2C features | Customer teams | Cart, address, checkout, reviews, returns |
| B2B features | Dealer teams | MOQ/slabs, bulk cart, quote revision, credit terms |
| Page sections | Content/merchandising | Typed CMS modules with strict allowed compositions |
| Layouts | App architecture | Trust-domain navigation, boundaries and metadata |

Every component documents accessibility semantics, loading/empty/error, responsive behavior, token/theme use and tests. Props carry public/domain types—not raw API objects or ERP IDs. State stays at the narrowest owner. Feature components cannot import from another feature’s internals; expose a public barrel/contract. No component calculates authoritative price, availability, tax or entitlement.

