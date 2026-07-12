# ADR-019: Quotation Workflow

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

B2B prices and availability change while negotiations need durable records.

## Problem

A cart or mutable price response cannot represent offers, revisions, expiry and acceptance.

## Decision

Quotation is a versioned aggregate with DRAFT, REQUESTED, UNDER_REVIEW, OFFERED, REVISION_REQUESTED, ACCEPTED, REJECTED, EXPIRED, CANCELLED and CONVERTED states. Each revision snapshots customer-safe line descriptions and quoted amounts, carries expiry, MOQ and terms, and converts idempotently to one order.

## Alternatives

Email/PDF only; reuse cart; mutable quote without revisions.

## Consequences

Storage, expiry jobs and concurrency control are required; negotiations are traceable.

## Future impact

E-signature, export terms and marketplace RFQs can extend revisions.

