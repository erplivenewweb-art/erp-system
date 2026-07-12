# Deployment Architecture

```text
www.brand.com  -> separately deployed Next.js storefront
api.brand.com  -> future Commerce API
erp.brand.com  -> existing ERP, unchanged
```

Development, staging, preview and production use distinct storefront/commerce credentials and data. Preview is access-controlled, noindex and uses sanitized fixtures/staging APIs. Browser-visible variables are allowlisted and non-secret; secrets stay server/platform vault.

Storefront deploy owns build, health/readiness, CDN, cache-tag invalidation, rollback, monitoring, logs, metrics and alerts. Immutable deploy IDs coordinate caches; rollback restores prior storefront only. TLS/HSTS/domain/DNS ownership is explicit.

No ERP Railway/Nixpacks/root package/service worker/health route changes. ERP deploy and rollback remain independent. Hosting platform is open; validate Next.js streaming, cache coordination, image optimization, regions, logs, preview security and cost before approval.

