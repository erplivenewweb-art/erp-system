# B2B Model

DealerAccount is an organization identity realm distinct from retail customers and ERP staff. DealerProfile, application, business addresses, encrypted document references, approval history, category, level, price-list assignment and credit terms are explicit from day one.

Application uniqueness uses company scope plus normalized GST/legal-identity fingerprint for active submissions. Raw documents live in protected object storage; ordinary tables hold opaque references, classification, digest, retention and review status only.

Only approved, active dealers receive wholesale visibility. Price resolution considers dealer assignment, level/category, special price, quantity break, MOQ and validity. Dealer carts recalculate slabs on quantity changes. Quotations retain immutable revisions and approvals:

```text
REQUESTED -> UNDER_REVIEW -> OFFERED -> REVISION_REQUESTED
          -> APPROVED/REJECTED/EXPIRED -> CONVERTED
```

Accepted quotations may later create exactly one `WEBSITE_WHOLESALE` staged order under an idempotency key. Credit terms are entitlements, not payment evidence; every use requires current server-side approval.

