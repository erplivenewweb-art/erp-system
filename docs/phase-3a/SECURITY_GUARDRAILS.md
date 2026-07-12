# Security Guardrails

- Public environment values require `NEXT_PUBLIC_` and explicit allowlisting in `src/config/env.ts`; only scaffold mode is currently allowed.
- No secrets, database credentials or production domains exist.
- `commercePath` constructs only public/customer/dealer Commerce namespace paths.
- Boundary script scans browser source for `/internal/v1/`, known ERP route/auth strings and DB credential names.
- Tests confirm runtime dependencies are only Next/React/React DOM and reject unsafe resource paths.
- Browser tokens are impossible because no auth/API implementation exists.
- Next config removes `X-Powered-By`, sets nosniff, referrer, frame and permissions headers.
- CSP is report-only during scaffold because final nonce/hosting behavior is undecided; no authored inline script exists. Enforcement requires Phase 3 security review.
- Turbopack root is explicitly `storefront/`, preventing ERP-root workspace inference.
- Package versions are exact and PostCSS is overridden to patched 8.5.16. Final audit: zero vulnerabilities.

Safe request boundary: browser → future `/commerce/v1/{public|customer|dealer}/...` only. Internal adapter/ERP access is server-side outside storefront and forbidden here.

