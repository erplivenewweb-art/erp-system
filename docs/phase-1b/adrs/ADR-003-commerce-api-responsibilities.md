# ADR-003: Commerce API Responsibilities

- Status: Accepted for Phase 1B contract design
- Date: 2026-07-11
- Scope: Planning only; no runtime authorization

## Context

Channels need a stable customer-safe boundary.

## Problem

Without one, clients would couple to ERP fields and business internals.

## Decision

Commerce API owns catalogue projections, search, content, identities, carts/wishlists/reviews later, quotations and commerce order orchestration. It never queries ERP tables directly and exposes opaque commerce IDs.

## Alternatives

Clients call ERP; a thin gateway mirroring ERP; one API per channel.

## Consequences

Projection latency and synchronization exist; clients get one safe, channel-neutral contract.

## Future impact

The same API supports web, dealer, mobile, marketplace, export, and AI with scoped views.

