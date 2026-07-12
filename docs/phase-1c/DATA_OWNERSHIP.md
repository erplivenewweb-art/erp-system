# Data Ownership

| Domain | Source of truth | Commerce treatment |
|---|---|---|
| Company, branch, staff identity/roles | ERP | Server-side opaque scope/reference only; never public |
| Manufacturing, process lots, purity, actual weight, size | ERP | Approved customer-safe projection only when required |
| Physical barcode units, stock, movements, inventory state | ERP | Coarse expiring availability cache; never exact public quantity |
| Billing, GST, invoice, returns, offline sales | ERP | Safe immutable reference/status projection |
| Customer/dealer accounts, sessions, consent | Commerce | Commerce-owned, separate identity realms |
| Merchandising, titles, slugs, stories, SEO, media, collections | Commerce | Authoritative commerce content |
| Cart, wishlist, reviews, coupon/campaign | Commerce | Commerce-owned |
| Quotation and website order staging | Commerce | Historical snapshots; future controlled conversion |
| Payment/shipping requests | Commerce/provider | Provider owns regulated mechanics; ERP owns accounting/fulfilment facts |
| Price | Contextual | Commerce rules/cache may present; an expiring server quote is authoritative for the transaction; ERP retains GST/billing validation |

## Never duplicated as a second source of truth

Physical barcode records, exact stock ledgers, manufacturing/process data, ERP employee accounts or tokens, branch/company master data, accounting ledgers, GST calculation logic, invoices, returns, or offline sales. A projection carries provenance, `last_synced_at`, expiry and opaque reference; it cannot be edited as master data.

## Controlled exchange

ERP product/variant references, availability status, quote validation inputs/results, order-conversion reference, invoice reference, dispatch and tracking status cross only a versioned authenticated integration contract. Commerce database foreign keys never target ERP tables. Commerce never writes ERP tables; a future approved adapter may issue narrow, idempotent commands under ERP-owned authorization.

