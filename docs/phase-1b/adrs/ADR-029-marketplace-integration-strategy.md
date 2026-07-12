# ADR-029: Marketplace Integration Strategy

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Marketplaces vary in catalogues, orders, fees and webhook reliability.

## Problem

Embedding marketplace fields in core products/orders causes vendor coupling.

## Decision

Use anti-corruption adapters that map marketplace listings and orders to canonical v1 contracts. Maintain per-channel listing state, external opaque references, idempotency, signed webhook verification and reconciliation queues. ERP is reached only through normal commerce orchestration.

## Alternatives

Marketplace calls ERP; marketplace-specific core fields; manual CSV as sole path.

## Consequences

Adapters and mapping operations are required; core remains stable.

## Future impact

New marketplaces and social commerce are plug-ins around canonical contracts.

