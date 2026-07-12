# ADR-008: API Authentication Strategy

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Public, customer, dealer, channel, and service calls have distinct risk.

## Problem

One credential type cannot safely express all actors and scopes.

## Decision

Use OAuth 2.1/OIDC-style short-lived audience-bound access tokens for people; client credentials or workload identity plus mTLS for services; signed webhooks; PKCE for public clients. Anonymous catalogue access is explicitly allowlisted. Deny ERP tokens by issuer/audience.

## Alternatives

ERP JWT reuse; API keys everywhere; long-lived bearer tokens; cookie-only APIs.

## Consequences

Requires an identity provider, key rotation, scope design, CSRF controls, and revocation strategy.

## Future impact

Supports mobile, partners, marketplaces, and regional services through scoped audiences.

