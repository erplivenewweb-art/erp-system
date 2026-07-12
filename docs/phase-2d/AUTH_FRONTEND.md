# Frontend Authentication

Customer and dealer realms are separate from ERP staff identity. Browser sessions use Secure, HttpOnly, SameSite cookies; short access lifetime and rotating refresh/reuse detection are server responsibilities. Browser never reads tokens.

Server layouts resolve identity/approval and redirect to realm-specific login/return target validated against an allowlist. Dealer routes require live active approval/entitlement, not token claims alone. Customer pages enforce subject ownership.

Mutations require synchronizer/double-submit CSRF design plus Origin validation, depending on final provider. Logout revokes session server-side then clears all client state/tabs. Expiry preserves safe draft and reauthenticates; sensitive changes/quote acceptance may require recent auth. Password reset responses do not reveal account existence. Multi-tab rotation/revocation uses safe signals. ERP JWTs/cookies are rejected.

