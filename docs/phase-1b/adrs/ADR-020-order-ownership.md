# ADR-020: Order Ownership

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Commerce captures customer intent; ERP fulfills and bills.

## Problem

One shared order status would hide handoff failures and authority.

## Decision

Commerce owns channel order intent, customer-visible snapshot, idempotency, tracking projection and orchestration state. ERP owns accepted operational sales order, stock allocation, billing, GST, invoice, fulfillment and returns facts. IDs remain opaque and mapped; states are correlated, not overwritten.

## Alternatives

ERP-only public order; commerce owns fulfillment; shared database order.

## Consequences

Eventual consistency and reconciliation UI are required; operational truth remains ERP-owned.

## Future impact

Marketplaces and mobile create channel orders through the same idempotent boundary.

