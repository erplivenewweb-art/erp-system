# Idempotency and Concurrency

Dealer submission, quotation creation, order creation, refund creation, future reservation and ERP conversion require `Idempotency-Key`. Keys bind to actor, company, endpoint and canonical request digest. Reuse with the same digest returns the stored outcome; a changed digest returns 409. Records survive retry windows and are never used across trust domains.

Payment webhooks are unique by provider plus event ID, signature-verified before persistence, and processed monotonically from an inbox. Duplicate delivery returns success without reapplying state. ERP conversion has one unique commerce-order conversion identity; retries reuse it and reconcile unknown outcomes before retry.

Mutable carts, profiles, CMS content, applications and quotations carry integer `version` plus ETag. Updates require `If-Match`; stale versions return 412 with no mutation. Workflow transitions compare expected state/version atomically. Distributed retries use bounded exponential backoff with jitter, dead-letter review and correlation/causation IDs.

