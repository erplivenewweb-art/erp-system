# ADR-025: Error Handling

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Different clients need stable, safe failures.

## Problem

Raw exceptions can expose internals and inconsistent errors impede recovery.

## Decision

Use ErrorResponse with stable code, HTTP status, safe message, correlationId, optional field violations, retryable flag and metadata. Never include stack traces, SQL, ERP IDs or secrets. Map upstream failures to commerce codes and log restricted detail server-side.

## Alternatives

Raw errors; HTTP status only; always-200 envelopes.

## Consequences

Error-code registry and translation maintenance are required; clients can recover predictably.

## Future impact

Localized messages and partner-specific mappings can be layered over stable codes.

