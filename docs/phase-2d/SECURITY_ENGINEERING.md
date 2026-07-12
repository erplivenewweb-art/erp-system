# Security Engineering

Prevent XSS with React escaping, no raw HTML unless sanitized/typed CMS renderer, CSP nonces/hashes and Trusted Types review. CSRF on cookie mutations; BOLA/authorization enforced server-side with object/company scope. Payload allowlists prevent mass assignment. Redirects use same-origin/allowlist.

Uploads use signed restricted endpoints, type/magic/size/malware/quarantine. Server-side media fetches use allowlisted origins and SSRF protections. Credential stuffing controls sit at identity/edge. Replay uses nonce/idempotency/signature/timestamp. Tokens never enter client JS/localStorage/logs/URLs.

Headers: strict CSP, HSTS, frame-ancestors, nosniff, referrer/permissions policies and secure cookies. Dependencies are pinned, audited, provenance/lockfile reviewed, update-botted after approval and builds reproducible. Secrets are server-only environment values.

Response projections and tests prevent PII, tenant, wholesale price and ERP/internal-field leakage. Logs redact aggressively. Security review covers supply chain, preview deployments, source maps and third-party scripts.

