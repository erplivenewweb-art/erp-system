# ADR-004: ERP Integration API Responsibilities

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

ERP remains authoritative for operational domains.

## Problem

Commerce needs approved facts and commands without learning ERP schema or credentials.

## Decision

An ERP-owned, separately deployed Integration API publishes customer-safe product/inventory/pricing facts and accepts explicit idempotent order/quotation commands after later approval. It derives tenant/branch scope server-side, maps opaque references, audits every exchange, and never exposes ERP auth.

## Alternatives

Direct SQL; shared ORM; reuse existing ERP routes; file exports as the primary interface.

## Consequences

Adapter maintenance and explicit mapping are required; ERP schema and authorization stay encapsulated.

## Future impact

Versioned adapters can serve additional channels without changing ERP-facing semantics.

