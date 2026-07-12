# Request and Response Standards

Success: `{ "success": true, "data": ..., "metadata": { requestId, correlationId, generatedAt, contractVersion } }`. Error: `{ "success": false, "error": { code, message, status, retryable, correlationId, violations[] }, "metadata": ... }`. Partial batch results add per-item success/error plus aggregate counts; HTTP status reflects overall processing class.

Clients may send `X-Request-ID`; servers validate or replace it. `X-Correlation-ID` is generated/propagated across trusted services. Cursor pagination uses opaque signed cursors and limit 1–100. Filters/sorts/search fields are endpoint allowlists. Arbitrary field expansion is forbidden; documented `include` values have depth/cost limits.

`Accept-Language` uses BCP 47; `X-Currency` uses ISO 4217 and never overrides entitlement. `Idempotency-Key` is 16–128 characters and actor/company/operation scoped. `ETag` and `If-None-Match` support reads and optimistic writes; write conflicts return 412/409. Cache-Control distinguishes public, private and no-store.

Rate responses include `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` and 429 `Retry-After`. Deprecation uses `Deprecation`, `Sunset` and `Link: rel="successor-version"`. Validation violations contain safe JSON pointer, stable code and message—never rejected secret values.

