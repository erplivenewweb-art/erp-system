# ADR-024: Event and Audit Model

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Distributed workflows need traceability and replay safety.

## Problem

Mutable records alone cannot explain approvals, quotes, orders or integrations.

## Decision

Emit immutable, append-only domain events with eventId, type, occurredAt, actor class, aggregate opaque ID, schemaVersion, correlationId and causationId. Audit records include before/after field names or safe diffs but redact secrets. Delivery uses outbox/inbox and idempotent consumers later.

## Alternatives

Logs only; database triggers; synchronous callbacks only.

## Consequences

Storage and schema governance are required; reliable reconciliation and investigations improve.

## Future impact

Events feed mobile notifications, marketplaces, analytics and AI through approved projections.

