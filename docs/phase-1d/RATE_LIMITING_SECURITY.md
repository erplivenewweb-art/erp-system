# Rate Limiting and Security

Rate classes are independently configurable and subject to manual approval: PUBLIC_CATALOGUE, PUBLIC_SEARCH, AUTH_SENSITIVE, DEALER_APPLICATION, PUBLIC_QUOTE, DEALER_QUOTE, CART, CHECKOUT_PREVIEW, ORDER_CREATE, REVIEW_SUBMISSION, WEBHOOK, ADMIN_STANDARD, ADMIN_SENSITIVE, INTERNAL_READ and INTERNAL_MUTATION. Keys combine edge/IP reputation with actor, dealer organization, client and company. Distributed counters enforce burst and sustained quotas; privileged clients receive explicit scoped contracts, not bypasses.

Security controls cover IDOR/BOLA with subject/company lookups; permission checks per object; input allowlists against mass assignment; parameterized persistence; CMS sanitization/CSP; outbound URL allowlists and DNS/IP revalidation against SSRF; upload type/size/magic-byte/malware checks; credential-stuffing detection and breached-password controls; nonce/timestamp/idempotency replay defense; signed webhook verification; trusted-proxy configuration against rate bypass; response projection/negative tests for leakage; and mandatory cross-company isolation tests.

