# ADR-021: Payment Ownership

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Payment credentials and settlements are highly regulated.

## Problem

ERP must not receive card data; commerce must not become a ledger.

## Decision

A PCI-compliant payment provider owns payment method data and authorization mechanics. Commerce owns payment intent references and customer-visible state; ERP owns accounting, billing, GST and reconciliation facts. Webhooks are signed, idempotent and replay-safe.

## Alternatives

Store card data; ERP calls gateways directly for every channel; client trusts redirect result.

## Consequences

Provider dependency and webhook reconciliation are required; sensitive scope is minimized.

## Future impact

Multiple providers, export payment methods and marketplace settlements fit adapters.

