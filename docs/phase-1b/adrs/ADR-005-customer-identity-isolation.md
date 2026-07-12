# ADR-005: Customer Identity Isolation

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Retail customers are not ERP employees.

## Problem

Credential reuse would expose privileged trust domains.

## Decision

Commerce owns customer identities, credentials, sessions, consent, and account recovery in a dedicated identity boundary. No ERP employee account or token can authenticate a customer.

## Alternatives

Reuse ERP users/JWT; social identity only; anonymous-only commerce.

## Consequences

Separate lifecycle and support are needed; compromise does not grant ERP access.

## Future impact

Supports federation, passkeys, mobile, guest checkout, and regional consent later.

