# ADR-016: B2C Architecture

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Retail buyers need public discovery and private transactional journeys.

## Problem

Public catalogue, customer data, and ERP operations require separate protections.

## Decision

B2C channel consumes public catalogue/search/media/SEO and authenticated customer/cart/wishlist/review/order resources from Commerce API. Checkout later requests a server-side quote and creates an idempotent commerce order; ERP acceptance is an explicit downstream state.

## Alternatives

Direct ERP storefront; frontend-only commerce; B2B fork reused as retail.

## Consequences

Additional orchestration and eventual consistency; retail UX stays customer-safe.

## Future impact

Mobile B2C and guest checkout use the same contracts and actor scopes.

