# ADR-007: ERP Employee Identity Isolation

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

ERP employees hold operational privileges.

## Problem

Federating employee credentials into public commerce expands attack surface.

## Decision

ERP employee identity, JWTs, cookies, roles, and authorization remain exclusively inside ERP. Integration uses service identity, never forwarded employee credentials; administrative commerce access uses a separate workforce federation later.

## Alternatives

Reuse ERP login; forward ERP JWT; shared cookie domain.

## Consequences

Administrators may sign in twice unless federation is approved; trust boundaries remain clear.

## Future impact

Future SSO can exchange narrowly scoped tokens without sharing ERP sessions.

