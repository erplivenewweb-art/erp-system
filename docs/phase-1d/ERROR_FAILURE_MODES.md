# Errors and Failure Modes

- ERP unavailable: serve safe cached catalogue within policy; availability/pricing/order conversion fail closed with 503 and retry guidance.
- Commerce database unavailable: fail requests; never fall back to direct ERP calls.
- Stale catalogue: serve only within approved TTL with warning; suppress unpublished/unknown visibility.
- Stale availability/pricing: return UNAVAILABLE or PRICE_REFRESH_REQUIRED; block order promise.
- Payment/shipping timeout: mark UNKNOWN/PENDING, reconcile by provider reference; never assume failure or success.
- Duplicate webhook: acknowledge after signature/digest verification; no repeated transition.
- Unauthorized wholesale request: 403 `WHOLESALE_ACCESS_DENIED`; do not reveal whether special pricing exists.
- Cross-company attempt: 404 or safe 403 per policy, audit high severity, return no object metadata.
- Invalid internal reference: 422/404 safe code; never echo ERP ID.
- Partial ERP failure: preserve staged state and attempt log, reconcile before retry, emit alert; no compensating direct SQL.

Errors never contain stack traces, SQL, ERP identifiers, internal paths, secrets, raw provider payloads or sensitive field values.

