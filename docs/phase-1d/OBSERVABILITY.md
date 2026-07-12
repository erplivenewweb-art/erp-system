# Observability

Structured logs contain timestamp, service, environment, request/correlation/trace IDs, actor class and pseudonymous ID, company scope, route template, status, latency, outcome code and retry count. They exclude tokens, cookies, addresses, GST evidence, payment payloads, ERP IDs, SQL and bodies by default.

Metrics cover traffic, latency, errors, saturation, auth failures, rate limits, cache/freshness, quote expiry/recalculation, idempotency collisions, webhook duplicates/signature failures, integration attempts, conversion reconciliation and cross-company denials. Trace propagation stops/redacts at trust boundaries and never carries PII baggage.

Append-only audit events cover login/session security, dealer decisions, content publication, price assignment, quotation/order transition, refund request and integration command. Retention differs by operational logs, security audit, consent and legal records and requires approval.

Alerts include elevated 5xx/latency, stale availability/price, projection lag, conversion unknown outcomes, webhook signature failures, auth attacks, tenant-isolation denial spikes, dead letters and backup/restore health.

