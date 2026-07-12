# Typed API Client Architecture

Generate or hand-maintain typed models from approved Phase 1B/1D contracts in a commerce-only package, then validate untrusted responses at trust boundaries. Separate clients: public, customer, dealer and future admin. Browser and storefront server **never call `/internal/v1/` or existing ERP routes**.

Base client attaches validated request/correlation IDs, locale/currency, CSRF for mutations and credentials under same-site/BFF policy. It enforces endpoint timeouts, AbortSignal cancellation, safe retry matrix, Idempotency-Key for qualifying commands, cursor pagination, ETag/If-Match, rate-limit/Retry-After and cache directives.

Normalize errors to stable safe UI categories while retaining redacted correlation IDs. Retry GET/explicitly idempotent requests with bounded jitter; never blindly retry order/payment/quote acceptance. Logs contain route template/outcome/latency—not URL secrets, tokens, bodies, PII, wholesale values or internal references.

