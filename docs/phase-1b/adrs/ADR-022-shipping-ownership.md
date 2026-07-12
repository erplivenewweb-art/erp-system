# ADR-022: Shipping Ownership

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Customers need rates and tracking while ERP owns operational fulfillment.

## Problem

Mixing carrier data, branch internals and inventory detail risks leakage.

## Decision

Commerce owns customer-facing address, shipping selection, carrier abstraction and tracking projection. ERP owns fulfillment decisions and branch operations. Providers own labels/events; only sanitized milestones are exposed.

## Alternatives

ERP pages exposed; commerce owns warehouse decisions; carrier-specific client contracts.

## Consequences

Status mapping and reconciliation are required; internal locations remain hidden.

## Future impact

International duties and marketplace fulfillment extend provider adapters.

