# Authentication and Authorization

## Trust domains

Anonymous visitor; B2C customer; dealer applicant/approved dealer; commerce admin/content manager; ERP employee; internal workload. ERP staff JWTs/cookies are never accepted by Commerce, and customer/dealer tokens are never accepted by ERP.

Browser users use authorization-code/PKCE or equivalent standards-based login with short-lived audience-bound access tokens and rotating refresh sessions in Secure, HttpOnly, SameSite cookies. State-changing cookie requests require CSRF token plus Origin/Referer checks. Mobile uses Bearer access tokens with PKCE and OS secure storage; refresh tokens rotate and detect reuse.

Dealer tokens include identity, not permanent pricing authority. Approval, suspension, level, company and entitlements are resolved server-side each request. Admin permissions are granular and high-risk changes audited. Service calls use workload identity/mTLS plus short-lived tokens, exact audience/scope and network policy.

Signing keys use versioned KIDs, automated overlap rotation and emergency revocation. Nonces, timestamps, idempotency keys and webhook event IDs prevent replay. Authentication, authorization denial, session rotation/reuse, dealer decision, publishing, price assignment and integration commands emit redacted audit events.

