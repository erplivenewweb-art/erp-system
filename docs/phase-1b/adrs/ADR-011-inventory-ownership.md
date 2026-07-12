# ADR-011: Inventory Ownership

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Accurate inventory is operational and sensitive.

## Problem

Commerce must show availability without exposing quantities, branches, barcodes, or stock internals.

## Decision

ERP is sole inventory/stock owner. Commerce stores only a time-bounded availability cache with coarse InventoryStatus, sellable boolean, optional customer-safe lead time, source timestamp and expiry. No exact internal quantity by default.

## Alternatives

Commerce stock ledger; live ERP reads per request; exposing branch quantities.

## Consequences

Availability can be stale and must fail safely; ERP remains authoritative at reservation/order validation.

## Future impact

Multiple fulfillment regions can be represented as safe availability scopes later.

