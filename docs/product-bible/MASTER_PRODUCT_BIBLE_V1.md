# Master Product Bible v1.0

## Vision

Build a manufacturer-led premium Indian jewellery experience beginning with Silver Sankha and Silver Pola, serving B2C retail and approved B2B dealers with craft integrity, customer-safe facts and dignified service.

## Non-negotiable principles

ERP protection; separate trust/deployment/database boundaries; B2C and B2B from day one; opaque public IDs; evidence before claims; accessibility/performance/security as release gates; immutable transactional snapshots; no wholesale leakage; mobile-first; no direct browser/Commerce DB access to ERP.

## ERP protection and system boundaries

The existing ERP remains unchanged and authoritative for company, branch, employees/auth, manufacturing/process, physical barcode stock, operational inventory, purity/weight/size facts, GST, billing, invoices, returns and offline operations. Commerce owns customer/dealer identities, merchandising/CMS/SEO/media, carts/wishlists/reviews, applications, quotations, staged orders, payment/shipping requests, notifications and safe caches. Exchange occurs only through future versioned Commerce and private ERP Integration contracts.

Deployments: `www.brand.com` storefront, `api.brand.com` Commerce API and `erp.brand.com` existing ERP. Storefront never calls ERP or `/internal/v1/`.

## B2C and B2B

B2C covers public discovery, customer account, wishlist/cart, future checkout/order, tracking, returns and reviews. B2B has separate dealer organization identity, application/approval, visibility, level/category, wholesale/special pricing, MOQ/slabs, bulk cart, quotation revisions, credit visibility, orders and analytics. Login alone never grants dealer pricing.

## Data and API ownership

Commerce DB is separate from ERP DB. Public UUID/ULID IDs never reveal ERP IDs/barcodes. Orders, quotations, price/tax/address/product descriptions snapshot history. API namespaces are `/commerce/v1/public`, `customer`, `dealer`, future separate `admin`, and private `/internal/v1`. Major versions are parallel; additive v1 changes are tolerant-reader compatible.

## Brand, UX and visual principles

Quiet confidence, Indian craftsmanship, warm minimalism, truthful photography and evidence-led trust. Mobile source order, progressive disclosure and one primary action per region. Core palette is Ink/Ivory/Silver with scarce Vermilion and editorial Antique Gold. Serif editorial display plus sans UI. Dark/festival themes cannot change semantics, focus, layout or product accuracy.

## Frontend architecture

Future stack: Next.js App Router + React + TypeScript; CSS Modules with generated semantic custom properties. Server Components/default server rendering minimize hydration. Feature-oriented folders isolate public/customer/dealer features and shared/core layers. Commerce Admin/CMS is a separate future application.

Server state is authoritative; cookies hold inaccessible sessions; URL owns search; form/cart optimistic state is narrow and reversible. Typed clients call only Commerce namespaces. Public content uses static/ISR/streaming as appropriate; private/account/dealer routes are dynamic private/no-store.

## Security, accessibility and performance

Reject ERP JWT reuse. Secure HttpOnly rotating sessions, CSRF, authorization/BOLA controls, CSP, upload/SSRF defenses, pinned dependencies, tenant/wholesale negative tests and log redaction are mandatory. WCAG 2.2 AA is an exit gate with manual assistive-technology/disabled-user testing.

Targets: p75 LCP ≤2.5s, CLS ≤0.1, INP ≤200ms; critical CSS ≤20KB compressed; route-critical JS ≤50KB, initial first-party ≤150KB; fonts ≤100KB; LCP image usually ≤200KB; initial images ≤700KB.

## Testing and deployment

Testing layers: unit, component, contract/API, integration, visual, accessibility, performance, E2E, SEO and security. Fixtures are synthetic; storefront tests never access production/ERP DB. Phase 3 begins with isolated scaffold and proceeds through tokens, shell, home, catalogue, interaction, customer, dealer, CMS preview and hardening.

Storefront deployment, cache, health, rollback, monitoring and service worker remain independent from ERP. Preview is access-controlled/noindex/sanitized.

## Future roadmap

PWA, native customer/dealer apps, localization/currency, export, marketplaces, AI search/assistant, recommendations, voice and multi-brand use the same semantic tokens/contracts/IDs with separate approvals. No future feature may broaden ERP or data authority.

## Governance

Open legal, tax, credit, provider, brand, content and retention decisions must be approved by named owners. When summaries conflict, the newer approved ADR/contract plus explicit change record governs; ERP protection always wins.

